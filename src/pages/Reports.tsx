import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateReport } from '../services/ai';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FileText, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx } from 'clsx';
import { useLanguage } from '../contexts/LanguageContext';

export default function Reports() {
  const { language, t } = useLanguage();
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly'>('weekly');
  const [reportContent, setReportContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const history = useLiveQuery(async () => {
    const days = timeframe === 'weekly' ? 7 : 1;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return await db.mealHistory.where('date').aboveOrEqual(startDate).toArray();
  }, [timeframe]);


  const handleGenerateReport = async () => {
    if (!history || history.length === 0) {
      setError(t('notEnoughHistory'));
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const content = await generateReport(timeframe, history, language);
      setReportContent(content);
    } catch (err) {
      console.error(err);
      setError(t('failedReport'));
    } finally {
      setIsGenerating(false);
    }
  };

  const stats = history?.reduce(
    (acc, curr) => {
      if (curr.status === 'eaten') acc.eaten++;
      if (curr.status === 'rejected') acc.rejected++;
      if (curr.status === 'partial') acc.partial++;
      return acc;
    },
    { eaten: 0, rejected: 0, partial: 0 }
  ) || { eaten: 0, rejected: 0, partial: 0 };

  const chartData = [
    { name: t('eaten'), value: stats.eaten, color: '#34C759' }, // iOS Green
    { name: t('pending'), value: stats.partial, color: '#007AFF' }, // iOS Blue
    { name: t('rejected'), value: stats.rejected, color: '#FF3B30' }, // iOS Red
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-2">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-black">{t('repTitle')}</h2>
          <p className="text-gray-500 font-medium mt-1">{t('repDesc')}</p>
        </div>
        <div className="bg-gray-200/60 p-1 rounded-full flex space-x-1">
          <button
            onClick={() => setTimeframe('daily')}
            className={clsx(
              "px-4 py-2 text-sm font-semibold rounded-full transition-all",
              timeframe === 'daily' ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t('daily')}
          </button>
          <button
            onClick={() => setTimeframe('weekly')}
            className={clsx(
              "px-4 py-2 text-sm font-semibold rounded-full transition-all",
              timeframe === 'weekly' ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t('weekly')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mx-2">
        <div className="bg-white rounded-[28px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center justify-center text-center">
          <CheckCircle2 className="text-[#34C759] mb-2" size={32} />
          <p className="text-4xl font-bold text-black tracking-tight">{stats.eaten}</p>
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mt-1">{t('mealsEaten')}</p>
        </div>
        <div className="bg-white rounded-[28px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center justify-center text-center">
          <XCircle className="text-[#FF3B30] mb-2" size={32} />
          <p className="text-4xl font-bold text-black tracking-tight">{stats.rejected}</p>
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mt-1">{t('mealsRejected')}</p>
        </div>
      </div>

      <div className="bg-white rounded-[28px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-64 mx-2">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t('acceptanceRate')}</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8E8E93', fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: '#F2F2F7' }}
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 30px rgb(0 0 0 / 0.12)' }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden mx-2">
        <div className="p-6 border-b border-black/5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#007AFF]/10 rounded-full flex items-center justify-center">
              <FileText className="text-[#007AFF]" size={20} />
            </div>
            <h3 className="text-xl font-bold text-black tracking-tight">{t('aiAnalysis')}</h3>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating || !history?.length}
            className="flex items-center space-x-2 bg-[#F2F2F7] text-[#007AFF] px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 active:scale-95"
          >
            <RefreshCw size={16} className={clsx(isGenerating && "animate-spin")} />
            <span>{t('generate')}</span>
          </button>
        </div>
        
        <div className="p-6">
          {error && (
            <div className="bg-[#FF3B30]/10 text-[#FF3B30] p-4 rounded-[20px] flex items-start space-x-3 mb-4">
              <AlertCircle className="shrink-0 mt-0.5" size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-8 h-8 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">{t('analyzing')}</p>
            </div>
          ) : reportContent ? (
            <div className="prose prose-blue prose-sm max-w-none">
              <ReactMarkdown>{reportContent}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 italic">{t('clickGenerate')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
