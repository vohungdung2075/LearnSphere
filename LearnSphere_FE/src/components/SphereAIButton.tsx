import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { api, getAIErrorMessage, getStoredUser, type Course, type Lesson } from '../services/api';

type SphereAIButtonProps = {
  className?: string;
  href?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type PopupPosition = {
  x: number;
  y: number;
};

type PopupSize = {
  width: number;
  height: number;
};

const POPUP_MARGIN = 12;
const POPUP_GAP = 16;
const MAX_POPUP_WIDTH = 420;
const MAX_POPUP_HEIGHT = 640;

function getPopupSize(): PopupSize {
  const availableWidth = Math.max(300, window.innerWidth - POPUP_MARGIN * 2);
  const availableHeight = Math.max(320, window.innerHeight - POPUP_MARGIN * 2);

  return {
    width: Math.min(MAX_POPUP_WIDTH, availableWidth),
    height: Math.min(MAX_POPUP_HEIGHT, availableHeight),
  };
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Chào bạn, mình là Sphere AI. Bạn có thể hỏi mình về bài học, quiz, tài liệu hoặc cách tiếp tục lộ trình học.',
  },
];

export function SphereAIButton({ className = '', href = '/ai-assistant' }: SphereAIButtonProps) {
  const user = getStoredUser();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [contextError, setContextError] = useState('');
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({ x: POPUP_MARGIN, y: POPUP_MARGIN });
  const [popupSize, setPopupSize] = useState<PopupSize>({ width: MAX_POPUP_WIDTH, height: MAX_POPUP_HEIGHT });
  const [isDragging, setIsDragging] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const initialAIContext = useMemo(() => {
    const queryIndex = href.indexOf('?');
    const params = new URLSearchParams(queryIndex >= 0 ? href.slice(queryIndex + 1) : '');
    return {
      courseId: params.get('course_id') || '',
      lessonId: params.get('lesson_id') || '',
    };
  }, [href]);

  const selectedCourse = useMemo(() => courses.find((course) => course._id === selectedCourseId), [courses, selectedCourseId]);
  const selectedLesson = useMemo(() => lessons.find((lesson) => lesson._id === selectedLessonId), [lessons, selectedLessonId]);
  const assistantPageHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCourseId) params.set('course_id', selectedCourseId);
    if (selectedLessonId) params.set('lesson_id', selectedLessonId);
    const query = params.toString();
    return `/ai-assistant${query ? `?${query}` : ''}`;
  }, [selectedCourseId, selectedLessonId]);
  const userId = user?._id ?? user?.id ?? '';

  useEffect(() => {
    setSelectedCourseId(initialAIContext.courseId);
    setSelectedLessonId(initialAIContext.lessonId);
  }, [initialAIContext.courseId, initialAIContext.lessonId]);

  useEffect(() => {
    if (!isOpen || !user) return;

    let isActive = true;
    setIsLoadingCourses(true);
    setContextError('');

    const loadCourses = user.role === 'student'
      ? api.getMyCourses().then((enrollments) => enrollments
          .filter((item) => item.status === 'active' && typeof item.course_id === 'object')
          .map((item) => item.course_id as Course))
      : api.getCourses().then((items) => {
          if (user.role === 'tutor') {
            return items.filter((course) => {
              const ownerId = typeof course.created_by === 'object' ? course.created_by._id : course.created_by;
              return ownerId === userId;
            });
          }
          return items;
        });

    loadCourses
      .then((items) => {
        if (!isActive) return;

        setCourses(items);
        setSelectedCourseId((current) => {
          if (!current || items.some((course) => course._id === current)) return current;
          setSelectedLessonId('');
          return '';
        });
      })
      .catch((error) => {
        if (!isActive) return;
        setCourses([]);
        setLessons([]);
        setContextError(getAIErrorMessage(error, 'Không thể tải khóa học cho trợ lý AI.'));
      })
      .finally(() => {
        if (isActive) setIsLoadingCourses(false);
      });

    return () => {
      isActive = false;
    };
  }, [isOpen, user?.role, userId]);

  useEffect(() => {
    if (!isOpen || !selectedCourseId) {
      setLessons([]);
      setSelectedLessonId('');
      return;
    }

    let isActive = true;
    setIsLoadingLessons(true);
    setContextError('');

    api.getLessons(selectedCourseId)
      .then((items) => {
        if (!isActive) return;

        setLessons(items);
        setSelectedLessonId((current) => {
          if (!current || items.some((lesson) => lesson._id === current)) return current;
          return '';
        });
      })
      .catch((error) => {
        if (!isActive) return;
        setLessons([]);
        setSelectedLessonId('');
        setContextError(getAIErrorMessage(error, 'Không thể tải bài học cho trợ lý AI.'));
      })
      .finally(() => {
        if (isActive) setIsLoadingLessons(false);
      });

    return () => {
      isActive = false;
    };
  }, [isOpen, selectedCourseId]);

  function openChat() {
    const size = getPopupSize();
    const buttonRect = buttonRef.current?.getBoundingClientRect();
    const fallbackX = window.innerWidth - size.width - POPUP_MARGIN;
    const fallbackY = window.innerHeight - size.height - POPUP_MARGIN;

    let nextX = fallbackX;
    let nextY = fallbackY;

    if (buttonRect) {
      const hasRoomOnLeft = buttonRect.left >= size.width + POPUP_GAP + POPUP_MARGIN;
      nextX = hasRoomOnLeft ? buttonRect.left - size.width - POPUP_GAP : fallbackX;
      nextY = buttonRect.bottom - size.height;
    }

    setPopupSize(size);
    setPopupPosition({
      x: clamp(nextX, POPUP_MARGIN, window.innerWidth - size.width - POPUP_MARGIN),
      y: clamp(nextY, POPUP_MARGIN, window.innerHeight - size.height - POPUP_MARGIN),
    });
    setIsDragging(false);
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleDragStart(event: PointerEvent<HTMLElement>) {
    const popup = event.currentTarget.closest('[data-ai-popup="true"]') as HTMLElement | null;
    if (!popup) return;

    const rect = popup.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setPopupPosition({ x: rect.left, y: rect.top });
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDragMove(event: PointerEvent<HTMLElement>) {
    if (!isDragging) return;

    const nextX = clamp(event.clientX - dragOffsetRef.current.x, POPUP_MARGIN, window.innerWidth - popupSize.width - POPUP_MARGIN);
    const nextY = clamp(event.clientY - dragOffsetRef.current.y, POPUP_MARGIN, window.innerHeight - popupSize.height - POPUP_MARGIN);
    setPopupPosition({ x: nextX, y: nextY });
  }

  function handleDragEnd(event: PointerEvent<HTMLElement>) {
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function sendMessage(content: string) {
    const normalized = content.trim();
    if (!user) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-login-${Date.now()}`,
          role: 'assistant',
          content: 'Bạn cần đăng nhập để Sphere AI có thể truy cập khóa học và bài học của bạn.',
        },
      ]);
      return;
    }
    if (!normalized || isSending) return;

    const nextUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: normalized,
    };

    setMessages((current) => [...current, nextUserMessage]);
    setInput('');
    setIsSending(true);

    try {
      const result = await api.chatWithAI({
        message: normalized,
        course_id: selectedCourseId || undefined,
        lesson_id: selectedLessonId || undefined,
      });
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${result.id}`,
          role: 'assistant',
          content: result.reply,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: getAIErrorMessage(error, 'Không thể gửi câu hỏi tới Sphere AI.'),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  const popupNode = isOpen ? (
        <section
          className="sphere-ai-popup fixed flex overflow-hidden rounded-2xl border border-[#414754] bg-[#0d131f] text-[#dde2f4] shadow-2xl shadow-black/50"
          data-ai-popup="true"
          style={{
            left: popupPosition.x,
            top: popupPosition.y,
            width: popupSize.width,
            height: popupSize.height,
            zIndex: 2147483647,
          }}
        >
          <button
            className="absolute right-14 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#414754] bg-[#242a37] text-[#c1c6d7] shadow-lg transition hover:border-[#adc7ff]/50 hover:text-[#adc7ff]"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              window.location.href = assistantPageHref;
            }}
            aria-label="Mở trang trợ lý AI"
            title="Mở trang trợ lý AI"
          >
            <span className="material-symbols-outlined text-[19px]">open_in_full</span>
          </button>
          <button
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#414754] bg-[#242a37] text-[#c1c6d7] shadow-lg transition hover:border-[#adc7ff]/50 hover:text-[#adc7ff]"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setIsOpen(false)}
            aria-label="Đóng trợ lý AI"
          >
            <span className="material-symbols-outlined text-[19px]">close</span>
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <header
              className={`flex h-16 cursor-grab touch-none select-none items-center justify-between border-b border-[#414754] bg-[#161c28] px-6 pr-28 ${isDragging ? 'cursor-grabbing' : ''}`}
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4a8eff]/20 text-[#adc7ff]">
                  <span className="material-symbols-outlined text-[21px]">bolt</span>
                </span>
                <div>
                  <h2 className="text-[17px] font-bold text-[#e7ecff]">Trợ lý AI LearnSphere</h2>
                  <p className="mt-0.5 font-mono text-[11px] text-[#8b90a0]">
                    <span className="material-symbols-outlined align-[-3px] text-[13px]">open_with</span>
                    Kéo thanh này để di chuyển
                  </p>
                </div>
              </div>
            </header>

            <section className="border-b border-[#414754] bg-[#111827]">
              <button
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-[#161f2e]"
                type="button"
                onClick={() => setIsContextOpen((current) => !current)}
                aria-expanded={isContextOpen}
              >
                <span className="material-symbols-outlined text-[18px] text-[#adc7ff]">tune</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[#8b90a0]">Ngữ cảnh</span>
                  <span className="mt-0.5 block truncate text-[13px] text-[#e7ecff]">
                    {selectedLesson?.title ?? selectedCourse?.title ?? 'Hỏi chung'}
                  </span>
                </span>
                <span className={`material-symbols-outlined text-[20px] text-[#8b90a0] transition ${isContextOpen ? 'rotate-180' : ''}`}>expand_more</span>
              </button>

              {isContextOpen && (
                <div className="space-y-3 border-t border-[#253047] px-5 py-3">
                  {user ? (
                    <>
                      <label className="block min-w-0">
                        <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#8b90a0]">Khóa học</span>
                        <select
                          className="w-full rounded-xl border border-[#354055] bg-[#070d19] px-3 py-2 text-[13px] text-[#e7ecff] outline-none transition focus:border-[#8fb7ff] disabled:cursor-not-allowed disabled:opacity-60"
                          value={selectedCourseId}
                          disabled={isLoadingCourses || isSending}
                          onChange={(event) => {
                            setSelectedCourseId(event.target.value);
                            setSelectedLessonId('');
                            setMessages((current) => current.length === 1 ? current : [
                              ...current,
                              {
                                id: `context-${Date.now()}`,
                                role: 'assistant',
                                content: event.target.value
                                  ? 'Mình đã đổi ngữ cảnh khóa học. Câu hỏi tiếp theo sẽ bám theo khóa học bạn chọn.'
                                  : 'Mình đã chuyển về chế độ hỏi chung.',
                              },
                            ]);
                          }}
                        >
                          <option value="">Hỏi chung</option>
                          {courses.map((course) => (
                            <option key={course._id} value={course._id}>{course.title}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block min-w-0">
                        <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#8b90a0]">Bài học</span>
                        <select
                          className="w-full rounded-xl border border-[#354055] bg-[#070d19] px-3 py-2 text-[13px] text-[#e7ecff] outline-none transition focus:border-[#8fb7ff] disabled:cursor-not-allowed disabled:opacity-60"
                          value={selectedLessonId}
                          disabled={!selectedCourseId || isLoadingLessons || isSending}
                          onChange={(event) => {
                            setSelectedLessonId(event.target.value);
                            setMessages((current) => current.length === 1 ? current : [
                              ...current,
                              {
                                id: `context-${Date.now()}`,
                                role: 'assistant',
                                content: event.target.value
                                  ? 'Mình đã đổi sang bài học này. Câu hỏi tiếp theo sẽ ưu tiên nội dung của bài học đã chọn.'
                                  : 'Mình đã chuyển về phạm vi toàn bộ khóa học.',
                              },
                            ]);
                          }}
                        >
                          <option value="">{selectedCourseId ? 'Toàn bộ khóa học' : 'Chọn khóa học trước'}</option>
                          {lessons.map((lesson) => (
                            <option key={lesson._id} value={lesson._id}>{lesson.order_index}. {lesson.title}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    <div className="rounded-xl border border-[#ffcc7a]/30 bg-[#ffcc7a]/10 px-4 py-3 text-[13px] leading-5 text-[#ffcc7a]">
                      Đăng nhập để chọn khóa học, bài học và hỏi AI theo nội dung học tập của bạn.
                    </div>
                  )}
                  {contextError && <p className="text-[12px] leading-5 text-[#ffb4ab]">{contextError}</p>}
                </div>
              )}
            </section>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-[#0d131f] p-5 md:p-6">
              {messages.map((message) => (
                <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex gap-3'}>
                  {message.role === 'assistant' && (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4a8eff] text-[#00285b]">
                      <span className="material-symbols-outlined text-[19px]">bolt</span>
                    </span>
                  )}
                  <div
                    className={`break-words rounded-2xl border px-5 py-4 text-[15px] leading-7 ${
                      message.role === 'user'
                        ? 'max-w-[80%] rounded-tr-none border-[#414754] bg-[#2f3542] text-[#e7ecff]'
                        : 'max-w-[88%] rounded-tl-none border-[#adc7ff]/25 bg-[#161c28]/80 text-[#c1c6d7]'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <h3 className="mb-2 flex items-center gap-2 font-bold text-[#adc7ff]">
                        <span className="material-symbols-outlined text-[16px]">info</span>
                        Gợi ý từ Sphere AI
                      </h3>
                    )}
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4a8eff] text-[#00285b]">
                    <span className="material-symbols-outlined animate-spin text-[19px]">progress_activity</span>
                  </span>
                  <div className="rounded-2xl rounded-tl-none border border-[#adc7ff]/25 bg-[#161c28]/80 px-4 py-3 font-mono text-[12px] text-[#adc7ff]">
                    Sphere AI đang xử lý...
                  </div>
                </div>
              )}
            </div>

            <footer className="border-t border-[#414754] bg-gradient-to-t from-[#0d131f] via-[#0d131f] to-transparent p-4">
              <form className="relative" onSubmit={handleSubmit}>
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#adc7ff] to-[#24dfba] opacity-20 blur transition focus-within:opacity-40" />
                <div className="relative flex items-end gap-3 rounded-2xl border border-[#414754] bg-[#242a37] p-3">
                  <textarea
                    ref={inputRef}
                    className="max-h-28 min-h-[48px] min-w-0 flex-1 resize-none border-none bg-transparent px-2 py-2 text-[15px] leading-6 text-[#e7ecff] outline-none placeholder:text-[#8b90a0] focus:ring-0"
                    placeholder={user ? 'Hỏi AI...' : 'Đăng nhập để hỏi AI...'}
                    maxLength={4000}
                    rows={2}
                    disabled={!user || isSending}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  <button className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#adc7ff] text-[#002e68] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!user || !input.trim() || isSending} aria-label="Gửi">
                    <span className="material-symbols-outlined">send</span>
                  </button>
                </div>
              </form>
            </footer>
          </div>
        </section>
  ) : null;

  const assistantLayer =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="sphere-ai-root" aria-live="polite">
            {popupNode}

      <button
        ref={buttonRef}
        type="button"
        className={`sphere-ai-launcher ai-assistant-pulse group fixed bottom-8 right-8 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/10 bg-[linear-gradient(135deg,#adc7ff,#24dfba)] text-[#002e68] shadow-2xl shadow-black/35 transition-transform active:scale-95 hover:scale-105 ${className}`}
        aria-label="Hỏi Sphere AI"
        onClick={openChat}
        style={{ zIndex: 2147483646 }}
      >
        <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: '"FILL" 1' }}>
          psychology
        </span>
        <span className="pointer-events-none absolute bottom-full right-0 mb-4 whitespace-nowrap rounded-xl border border-white/5 bg-[#2f3542] px-4 py-2 font-mono text-[12px] text-[#dde2f4] opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
          Hỏi Sphere AI
        </span>
          </button>
          </div>,
          document.body,
        )
      : null;

  return assistantLayer;
}
