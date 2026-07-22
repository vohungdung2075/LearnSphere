import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { RoleSidebar } from '../components/RoleSidebar';
import { canStudy, getRoleLabel } from '../lib/roleAccess';
import {
  api,
  getAIErrorMessage,
  getStoredUser,
  type AIHistoryItem,
  type Course,
  type Lesson,
} from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD3CAHLhxx8msEYYRpTMyyPTzFwpCWL5PbXXUGXiPfT3Bzzn0F2yP_WVSD3QV6axYjYiZFkCxTihFF6TuGD8rl4G8VTjcjoUy_mFiE-e6KQNkyRh5b5U8QjwZM0MXS43z0NxYLY9_pG5I8OQZtEQ2YIcdH2dxUijazGLgEuoivh59ouVsurBcIsf_PB29Vg4sbF054jvWCTxN3vjxQsOtKDg5CD2l_T6Y3PIbDPRt8CAnVJB_2ZUsIUaQ';

const fieldClass =
  'rounded-xl border border-[#354055] bg-[#070d19] px-3 py-2 text-[13px] text-[#e7ecff] outline-none focus:border-[#8fb7ff] disabled:cursor-not-allowed disabled:opacity-50';

export function AIAssistantPage() {
  const params = new URLSearchParams(window.location.search);
  const user = getStoredUser();
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<AIHistoryItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(params.get('course_id') ?? '');
  const [selectedLessonId, setSelectedLessonId] = useState(params.get('lesson_id') ?? '');
  const [pendingMessage, setPendingMessage] = useState('');
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [notice, setNotice] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!canStudy(user)) return;

    setIsLoadingContext(true);
    api.getMyCourses()
      .then((enrollments) => {
        const activeCourses = enrollments
          .filter((item) => item.status === 'active' && typeof item.course_id === 'object')
          .map((item) => item.course_id as Course);
        setCourses(activeCourses);

        if (selectedCourseId && !activeCourses.some((course) => course._id === selectedCourseId)) {
          setSelectedCourseId('');
          setSelectedLessonId('');
        }
      })
      .catch((error) => setNotice(getAIErrorMessage(error, 'Không thể tải khóa học của bạn.')))
      .finally(() => setIsLoadingContext(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?._id]);

  useEffect(() => {
    if (!selectedCourseId) {
      setLessons([]);
      setSelectedLessonId('');
      return;
    }

    setIsLoadingContext(true);
    api.getLessons(selectedCourseId)
      .then((items) => {
        setLessons(items);
        if (selectedLessonId && !items.some((lesson) => lesson._id === selectedLessonId)) {
          setSelectedLessonId('');
        }
      })
      .catch((error) => {
        setLessons([]);
        setSelectedLessonId('');
        setNotice(getAIErrorMessage(error, 'Không thể tải danh sách bài học.'));
      })
      .finally(() => setIsLoadingContext(false));
  }, [selectedCourseId, selectedLessonId]);

  useEffect(() => {
    if (!canStudy(user)) return;

    setIsLoadingHistory(true);
    setHistory([]);
    api.getAIHistory({
      course_id: selectedCourseId || undefined,
      lesson_id: selectedLessonId || undefined,
      limit: 50,
    })
      .then((result) => setHistory(result.items))
      .catch((error) => setNotice(getAIErrorMessage(error, 'Không thể tải lịch sử trò chuyện.')))
      .finally(() => setIsLoadingHistory(false));
  }, [selectedCourseId, selectedLessonId, user?.id, user?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, pendingMessage, isSending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isSending) return;

    setMessage('');
    setPendingMessage(trimmed);
    setIsSending(true);
    setNotice('');

    try {
      const result = await api.chatWithAI({
        message: trimmed,
        course_id: selectedCourseId || undefined,
        lesson_id: selectedLessonId || undefined,
      });
      setHistory((current) => [
        ...current,
        {
          _id: result.id,
          course_id: selectedCourseId || null,
          lesson_id: selectedLessonId || null,
          user_message: trimmed,
          ai_response: result.reply,
          model_id: result.model_id,
          input_tokens: result.usage?.input_tokens,
          output_tokens: result.usage?.output_tokens,
          total_tokens: result.usage?.total_tokens,
          stop_reason: result.stop_reason,
          createdAt: new Date().toISOString(),
        },
      ]);
      setPendingMessage('');
    } catch (error) {
      setMessage(trimmed);
      setPendingMessage('');
      setNotice(getAIErrorMessage(error, 'Không thể gửi câu hỏi tới trợ lý AI.'));
    } finally {
      setIsSending(false);
    }
  }

  async function handleClearHistory() {
    if (!history.length || isClearing) return;
    if (!window.confirm('Xóa lịch sử trong ngữ cảnh đang chọn?')) return;

    setIsClearing(true);
    try {
      const result = await api.deleteAIHistory({
        course_id: selectedCourseId || undefined,
        lesson_id: selectedLessonId || undefined,
      });
      setHistory([]);
      setNotice(`Đã xóa ${result.deleted_count} lượt trò chuyện.`);
    } catch (error) {
      setNotice(getAIErrorMessage(error, 'Không thể xóa lịch sử trò chuyện.'));
    } finally {
      setIsClearing(false);
    }
  }

  if (!canStudy(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
        <section className="max-w-md rounded-xl border border-[#414754] bg-[#161c28] p-8 text-center">
          <span className="material-symbols-outlined mb-4 text-[48px] text-[#ffb4ab]">lock</span>
          <h1 className="text-[26px] font-semibold">Không có quyền truy cập</h1>
          <p className="mt-2 text-[#c1c6d7]">Trợ lý AI học tập chỉ dành cho học viên.</p>
          <a className="mt-6 inline-flex rounded-lg bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68]" href="/dashboard">
            Về bảng điều khiển
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0d131f] text-[#dde2f4]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <AppToast message={notice} tone={notice.includes('Đã xóa') ? 'success' : 'error'} onClose={() => setNotice('')} durationMs={7000} />
      <RoleSidebar activePath="/ai-assistant" user={user} />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-[#0d131f] md:pl-64">
        <section className="z-20 flex flex-wrap items-center gap-3 border-b border-[#253047] bg-[#111827]/95 p-4 md:px-6">
          <div className="mr-auto">
            <h1 className="text-[20px] font-bold text-white">Sphere AI</h1>
            <p className="text-[12px] text-[#8f9bb3]">Câu trả lời được tạo bởi mô hình AI đã cấu hình</p>
          </div>
          <select
            className={fieldClass}
            value={selectedCourseId}
            disabled={isLoadingContext || isSending}
            onChange={(event) => {
              setSelectedCourseId(event.target.value);
              setSelectedLessonId('');
            }}
            aria-label="Chọn khóa học"
          >
            <option value="">Hỏi chung</option>
            {courses.map((course) => <option key={course._id} value={course._id}>{course.title}</option>)}
          </select>
          <select
            className={fieldClass}
            value={selectedLessonId}
            disabled={!selectedCourseId || isLoadingContext || isSending}
            onChange={(event) => setSelectedLessonId(event.target.value)}
            aria-label="Chọn bài học"
          >
            <option value="">Toàn bộ khóa học</option>
            {lessons.map((lesson) => <option key={lesson._id} value={lesson._id}>{lesson.title}</option>)}
          </select>
          <button
            className="rounded-xl border border-[#ffb4ab]/35 px-3 py-2 font-mono text-[12px] font-bold text-[#ffb4ab] disabled:opacity-40"
            type="button"
            disabled={!history.length || isClearing || isSending}
            onClick={() => void handleClearHistory()}
          >
            {isClearing ? 'Đang xóa...' : 'Xóa lịch sử'}
          </button>
        </section>

        <div className="z-10 flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
          {isLoadingHistory && <p className="text-center font-mono text-[12px] text-[#8b90a0]">Đang tải lịch sử...</p>}

          {!isLoadingHistory && !history.length && !pendingMessage && (
            <div className="flex h-full items-center justify-center">
              <section className="max-w-xl rounded-xl border border-dashed border-[#414754] bg-[#161c28] p-10 text-center">
                <span className="material-symbols-outlined mb-4 text-[56px] text-[#8b90a0]">smart_toy</span>
                <h2 className="text-[28px] font-semibold text-[#dde2f4]">Bắt đầu hội thoại AI</h2>
                <p className="mt-3 text-[#9da8bd]">Chọn khóa học hoặc bài học để nhận câu trả lời đúng ngữ cảnh.</p>
              </section>
            </div>
          )}

          {history.map((item) => (
            <div key={item._id} className="space-y-4">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-none border border-[#414754] bg-[#2f3542] p-4">
                  <p className="whitespace-pre-wrap text-[#dde2f4]">{item.user_message}</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-tl-none border border-[#24dfba]/25 bg-[#111827] p-4 shadow-xl shadow-black/10">
                  <p className="whitespace-pre-wrap leading-7 text-[#d8e0f2]">{item.ai_response}</p>
                  <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] text-[#738098]">
                    {item.model_id && <span>{item.model_id}</span>}
                    {typeof item.total_tokens === 'number' && <span>· {item.total_tokens} tokens</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {pendingMessage && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-none border border-[#414754] bg-[#2f3542] p-4">
                  <p className="whitespace-pre-wrap text-[#dde2f4]">{pendingMessage}</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="flex items-center gap-3 rounded-2xl rounded-tl-none border border-[#24dfba]/25 bg-[#111827] px-4 py-3 text-[#24dfba]">
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  <span className="font-mono text-[12px]">Sphere AI đang suy nghĩ...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="z-20 bg-gradient-to-t from-[#0d131f] via-[#0d131f] to-transparent p-4 md:px-6 md:pb-6">
          <form className="group relative" onSubmit={handleSubmit}>
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#adc7ff] to-[#24dfba] opacity-20 blur transition duration-300 group-focus-within:opacity-40" />
            <div className="relative flex items-center rounded-2xl border border-[#414754] bg-[#242a37] p-2">
              <input
                className="flex-1 border-none bg-transparent px-4 text-[#dde2f4] placeholder:text-[#8b90a0] focus:ring-0 disabled:opacity-60"
                placeholder="Nhập câu hỏi..."
                type="text"
                maxLength={4000}
                disabled={isSending || isLoadingHistory}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <button
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#adc7ff] text-[#00285b] transition-transform active:scale-90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={!message.trim() || isSending || isLoadingHistory}
                aria-label="Gửi"
              >
                <span className="material-symbols-outlined font-bold">send</span>
              </button>
            </div>
            <p className="mt-2 text-right font-mono text-[10px] text-[#657188]">{message.length}/4000</p>
          </form>
        </div>
      </main>
    </div>
  );
}
