import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import crypto from 'node:crypto';
import path from 'path';
import {defineConfig} from 'vite';

const XHJ_API_BASE = 'https://api.xhj.com/api';
const BASIC_AUTH = 'Basic d2ViOndlYl9zZWNyZXQ=';

function md5(value: string) {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex');
}

function sendJson(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json;charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readJsonBody(req: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function extractUserInfo(payload: any) {
  const source = payload?.obj ?? payload?.data ?? payload ?? {};
  const userInfo = source.userInfo ?? source.user_info ?? source.user ?? source;
  return {
    accessToken: source.access_token ?? source.accessToken ?? source['Blade-Auth'] ?? payload?.access_token ?? '',
    appSecretKey: userInfo?.appSecretKey ?? source.appSecretKey ?? payload?.appSecretKey ?? '',
    userId: userInfo?.userId ?? userInfo?.id ?? source.userId ?? '',
    username: userInfo?.username ?? source.username ?? '',
    userName: userInfo?.fullname ?? userInfo?.realName ?? userInfo?.name ?? source.fullname ?? '',
    deptId: userInfo?.deptId ?? userInfo?.departmentId ?? source.deptId ?? '',
    deptName: userInfo?.deptName ?? userInfo?.departmentName ?? source.deptName ?? '',
    postId: userInfo?.titleId ?? userInfo?.postId ?? source.titleId ?? ''
  };
}

function attendanceHeaders(accessToken: string, signature: string) {
  return {
    Authorization: BASIC_AUTH,
    'Blade-Auth': `bearer ${accessToken}`,
    client: '2',
    token: signature,
    'Content-Type': 'application/json;charset=utf-8'
  };
}

function attendanceProxyPlugin() {
  return {
    name: 'attendance-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/attendance/oauth-token', async (req: any, res: any) => {
        if (req.method !== 'POST') return sendJson(res, 405, { message: 'Method not allowed' });
        try {
          const body = await readJsonBody(req);
          const tenantId = String(body.tenantId || '804023');
          const username = String(body.username || '');
          const plainPassword = String(body.password || '');
          const password = body.passwordIsMd5 ? plainPassword : md5(plainPassword);
          const url = new URL(`${XHJ_API_BASE}/blade-auth/oauth/token`);
          url.searchParams.set('tenantId', tenantId);
          url.searchParams.set('username', username);
          url.searchParams.set('password', password);
          url.searchParams.set('grant_type', 'password');
          url.searchParams.set('scope', 'all');

          const upstream = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: BASIC_AUTH,
              'Tenant-Id': tenantId,
              'Captcha-Code': 'xhj',
              'Content-Type': 'application/json;charset=utf-8'
            }
          });
          const text = await upstream.text();
          const data = text ? JSON.parse(text) : {};
          sendJson(res, upstream.status, {
            upstream: data,
            auth: extractUserInfo(data)
          });
        } catch (error: any) {
          sendJson(res, 500, { message: error?.message || 'Token request failed' });
        }
      });

      server.middlewares.use('/api/attendance/context', async (req: any, res: any) => {
        if (req.method !== 'POST') return sendJson(res, 405, { message: 'Method not allowed' });
        try {
          const body = await readJsonBody(req);
          const requestBody = {
            coordinate: body.coordinate,
            departid: Number(body.deptId),
            userid: Number(body.userId),
            postId: Number(body.postId)
          };
          const raw = JSON.stringify(requestBody);
          const signature = md5(raw + String(body.appSecretKey || ''));
          const upstream = await fetch(`${XHJ_API_BASE}/xhj-attendance/cardRecord/getSchedulingCardRecord`, {
            method: 'POST',
            headers: attendanceHeaders(String(body.accessToken || ''), signature),
            body: raw
          });
          const text = await upstream.text();
          sendJson(res, upstream.status, {
            upstream: text ? JSON.parse(text) : {},
            requestBody,
            signature
          });
        } catch (error: any) {
          sendJson(res, 500, { message: error?.message || 'Attendance context request failed' });
        }
      });

      server.middlewares.use('/api/attendance/clock-in', async (req: any, res: any) => {
        if (req.method !== 'POST') return sendJson(res, 405, { message: 'Method not allowed' });
        try {
          const body = await readJsonBody(req);
          const requestBody: Record<string, unknown> = {
            signinType: Number(body.signinType || 1),
            signinOutRule: Number(body.signinOutRule || 0),
            cardCountId: Number(body.cardCountId),
            userid: Number(body.userId),
            userName: body.userName,
            departid: Number(body.deptId),
            departName: body.deptName,
            postId: Number(body.postId)
          };
          if (body.cardMode === 'wifi') {
            requestBody.signinWifi = body.signinWifi;
            requestBody.signinWifiMac = body.signinWifiMac;
            requestBody.signinCardType = 2;
          } else {
            requestBody.signinAddress = body.signinAddress;
            requestBody.signinCoordinate = body.coordinate;
            requestBody.signinCardType = 1;
          }
          if (body.signinPhoto) requestBody.signinPhoto = body.signinPhoto;
          if (body.signinRemarks) requestBody.signinRemarks = body.signinRemarks;

          const raw = JSON.stringify(requestBody);
          const signature = md5(raw + String(body.appSecretKey || ''));
          const upstream = await fetch(`${XHJ_API_BASE}/xhj-attendance/cardRecord/clockIn`, {
            method: 'POST',
            headers: attendanceHeaders(String(body.accessToken || ''), signature),
            body: raw
          });
          const text = await upstream.text();
          sendJson(res, upstream.status, {
            upstream: text ? JSON.parse(text) : {},
            requestBody,
            signature
          });
        } catch (error: any) {
          sendJson(res, 500, { message: error?.message || 'Clock-in request failed' });
        }
      });
    }
  };
}

export default defineConfig(({mode}) => {
  return {
    plugins: [react(), tailwindcss(), attendanceProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: ['triage-badge-confident.ngrok-free.dev'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
