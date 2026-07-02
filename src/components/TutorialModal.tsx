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
  isLoading: boolean;
}

export default function TutorialModal({ isOpen, onClose, title, content, isLoading }: TutorialModalProps) {
  const { language, t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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
        const utterance = new SpeechSynthesisUtterance(content.replace(/[#*`>-]/g, ' '));
        utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US';
        utterance.rate = 0.92;
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
          <h2 className="text-xl font-bold tracking-tight text-black line-clamp-1">{title}</h2>
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
        
        <div className="flex-1 overflow-y-auto p-6 pb-safe">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 space-y-4">
              <div className="w-8 h-8 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">{t('generatingRecipe')}</p>
            </div>
          ) : (
            <div className="prose prose-blue prose-sm max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
