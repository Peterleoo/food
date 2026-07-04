import { X, Square, Loader2, Volume2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../contexts/LanguageContext';
import { useState, useRef, useEffect } from 'react';
import { generateAudio } from '../services/ai';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  imageData?: string;
  imageDataList?: string[];
  isLoading: boolean;
}

function getReadableAudioText(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[-*`>]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pickNaturalVoice(language: 'zh' | 'en') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;

  const voices = window.speechSynthesis.getVoices();
  const preferredNames = language === 'zh'
    ? ['xiaoxiao', 'xiaoyi', 'tingting', 'huihui', 'google 普通话', 'mandarin', 'chinese']
    : ['samantha', 'jenny', 'aria', 'google us english', 'natural'];
  const langPrefix = language === 'zh' ? 'zh' : 'en';

  return voices.find(voice => preferredNames.some(name => voice.name.toLowerCase().includes(name)))
    || voices.find(voice => voice.lang.toLowerCase().startsWith(langPrefix))
    || voices[0];
}

export default function TutorialModal({ isOpen, onClose, title, content, imageData, imageDataList, isLoading }: TutorialModalProps) {
  const { language, t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const images = imageDataList?.length ? imageDataList : imageData ? [imageData] : [];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsPlaying(false);
    setIsAudioLoading(false);
    setIsImagePreviewOpen(false);
    setPreviewIndex(0);
  }, [content, isOpen]);

  const toggleAudio = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (isPlaying && utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      setIsPlaying(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsAudioLoading(true);
    try {
      const base64 = await generateAudio(content, language);
      if (base64) {
        const audio = new Audio(`data:audio/wav;base64,${base64}`);
        audio.onended = () => setIsPlaying(false);
        audioRef.current = audio;
        audio.play();
        setIsPlaying(true);
        return;
      }

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(getReadableAudioText(content));
        utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US';
        utterance.voice = pickNaturalVoice(language) || null;
        utterance.rate = language === 'zh' ? 0.88 : 0.9;
        utterance.pitch = 1.04;
        utterance.volume = 1;
        utterance.onend = () => {
          utteranceRef.current = null;
          setIsPlaying(false);
        };
        utterance.onerror = () => {
          utteranceRef.current = null;
          setIsPlaying(false);
        };
        utteranceRef.current = utterance;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAudioLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pwa-modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-sm">
      <div className="ios-modal-panel bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
          <h2 className="text-xl font-bold tracking-tight text-black line-clamp-1">{t('recipeDetailTitle')}</h2>
          <div className="flex items-center space-x-2">
            {!isLoading && content && (
              <button
                onClick={toggleAudio}
                disabled={isAudioLoading}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#007AFF]/10 text-[#007AFF] rounded-full text-sm font-semibold hover:bg-[#007AFF]/20 transition-colors active:scale-95 disabled:opacity-50"
              >
                {isAudioLoading ? <Loader2 size={16} className="animate-spin" /> : isPlaying ? <Square size={16} fill="currentColor" /> : <Volume2 size={16} />}
                <span>{isAudioLoading ? t('loadingAudio') : isPlaying ? t('stopAudio') : t('playAudio')}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 bg-[#F2F2F7] text-gray-500 hover:text-black hover:bg-gray-200 rounded-full transition-colors active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="ios-modal-scroll flex-1 overflow-y-auto p-6 pb-safe">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 space-y-4">
              <div className="w-8 h-8 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">{t('generatingRecipe')}</p>
            </div>
          ) : (
            <>
              {!!images.length && (
                <div className="mb-5 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewIndex(0);
                      setIsImagePreviewOpen(true);
                    }}
                    className="block w-full overflow-hidden rounded-[24px] bg-[#F2F2F7] active:scale-[0.99] transition-transform"
                  >
                    <img src={images[0]} alt={title} className="h-56 w-full object-cover" />
                  </button>
                  {images.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {images.slice(1).map((image, index) => (
                        <button
                          type="button"
                          key={`${image.slice(0, 24)}-${index}`}
                          onClick={() => {
                            setPreviewIndex(index + 1);
                            setIsImagePreviewOpen(true);
                          }}
                          className="aspect-square overflow-hidden rounded-[14px] bg-[#F2F2F7]"
                        >
                          <img src={image} alt={`${title} ${index + 2}`} className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="prose prose-blue max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="mb-5 mt-0 text-2xl font-bold tracking-tight text-black">{children}</h1>,
                    h2: ({ children }) => <h2 className="mb-5 mt-0 text-2xl font-bold tracking-tight text-black">{children}</h2>,
                    h3: ({ children }) => <h3 className="mb-2 mt-6 text-base font-bold tracking-tight text-black">{children}</h3>,
                    p: ({ children }) => <p className="my-2 text-sm leading-6 text-gray-700">{children}</p>,
                    li: ({ children }) => <li className="my-1 text-sm leading-6 text-gray-700">{children}</li>
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </>
          )}
        </div>
      </div>
      {isImagePreviewOpen && images[previewIndex] && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setIsImagePreviewOpen(false)}>
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/15 p-3 text-white" onClick={() => setIsImagePreviewOpen(false)}>
            <X size={24} />
          </button>
          <img src={images[previewIndex]} alt={title} className="max-h-full max-w-full rounded-[20px] object-contain" />
        </div>
      )}
    </div>
  );
}
