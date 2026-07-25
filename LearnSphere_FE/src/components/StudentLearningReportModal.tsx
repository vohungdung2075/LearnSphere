import type { StudentLearningReport } from '../services/api';

type StudentLearningReportModalProps = {
  isOpen: boolean;
  isLoading: boolean;
  report: StudentLearningReport | null;
  error: string;
  onClose: () => void;
};

const difficultyLabels: Record<string, string> = {
  basic: 'Cơ bản',
  medium: 'Trung bình',
  advanced: 'Nâng cao',
};

const attemptStatusLabels: Record<string, string> = {
  submitted: 'Đã nộp',
  in_progress: 'Đang làm',
  expired: 'Hết giờ',
};

function formatDateTime(value?: string | null) {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDuration(value?: number | null) {
  if (value === undefined || value === null) return 'Chưa hoàn thành';
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes} phút ${seconds} giây`;
}

export function StudentLearningReportModal({
  isOpen,
  isLoading,
  report,
  error,
  onClose,
}: StudentLearningReportModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Tiến độ học tập của học viên"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="relative m-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-[#354055] bg-[#0d1524] shadow-2xl shadow-black/60">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#253047] bg-[#111827]/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#24dfba]/25 bg-[#24dfba]/10 px-3 py-1 font-mono text-[11px] font-black uppercase tracking-wider text-[#24dfba]">
              <span className="material-symbols-outlined text-[16px]">monitoring</span>
              Hồ sơ học tập
            </span>
            <h2 className="mt-3 truncate text-[24px] font-extrabold text-white sm:text-[28px]">
              {report?.student.full_name ?? 'Đang tải học viên...'}
            </h2>
            {report && (
              <p className="mt-1 text-[14px] text-[#9da8bd]">
                {report.student.email} · {report.course.title}
              </p>
            )}
          </div>
          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#354055] text-[#b8c1d6] transition hover:border-[#ffb4ab]/50 hover:bg-[#ffb4ab]/10 hover:text-[#ffb4ab]"
            type="button"
            aria-label="Đóng hồ sơ học viên"
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        {isLoading && (
          <div className="flex min-h-80 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="h-11 w-11 animate-spin rounded-full border-4 border-[#354055] border-t-[#24dfba]" />
            <div>
              <p className="font-bold text-white">Đang tổng hợp tiến độ học tập...</p>
              <p className="mt-1 text-[13px] text-[#8f9bb3]">Đang lấy bài học và lịch sử làm quiz của học viên.</p>
            </div>
          </div>
        )}

        {!isLoading && error && (
          <div className="m-6 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 p-5 text-[#ffb4ab]">
            <p className="font-bold">Không thể tải hồ sơ học tập</p>
            <p className="mt-1 text-[14px]">{error}</p>
          </div>
        )}

        {!isLoading && report && (
          <div className="space-y-6 p-4 sm:p-6">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  label: 'Tiến độ bài học',
                  value: `${report.lesson_progress.progress_percent}%`,
                  detail: `${report.lesson_progress.completed_lessons}/${report.lesson_progress.total_lessons} bài`,
                  tone: 'text-[#24dfba]',
                },
                {
                  label: 'Quiz đã làm',
                  value: `${report.quiz_progress.attempted_quizzes}/${report.quiz_progress.total_quizzes}`,
                  detail: `${report.quiz_progress.submitted_attempts} lượt nộp`,
                  tone: 'text-[#adc7ff]',
                },
                {
                  label: 'Điểm trung bình',
                  value: `${report.quiz_progress.average_score_percent}%`,
                  detail: 'Các lượt đã nộp',
                  tone: 'text-[#ffc080]',
                },
                {
                  label: 'Điểm cao nhất',
                  value: `${report.quiz_progress.best_score_percent}%`,
                  detail: 'Kết quả tốt nhất',
                  tone: 'text-[#d5b8ff]',
                },
              ].map((item) => (
                <article key={item.label} className="rounded-xl border border-[#253047] bg-[#111827] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-wide text-[#8f9bb3]">{item.label}</p>
                  <strong className={`mt-2 block text-[26px] ${item.tone}`}>{item.value}</strong>
                  <p className="mt-1 text-[12px] text-[#8f9bb3]">{item.detail}</p>
                </article>
              ))}
            </section>

            <section className="overflow-hidden rounded-xl border border-[#253047] bg-[#111827]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#253047] px-5 py-4">
                <div>
                  <h3 className="text-[19px] font-extrabold text-white">Tiến độ bài học</h3>
                  <p className="mt-1 text-[13px] text-[#8f9bb3]">Những bài học đã được học viên đánh dấu hoàn thành.</p>
                </div>
                <span className="rounded-full bg-[#24dfba]/10 px-3 py-1 font-mono text-[12px] font-bold text-[#24dfba]">
                  {report.lesson_progress.progress_percent}%
                </span>
              </div>
              {!report.lesson_progress.lessons.length ? (
                <p className="p-6 text-center text-[#8f9bb3]">Khóa học chưa có bài học.</p>
              ) : (
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  {report.lesson_progress.lessons.map((lesson) => (
                    <article
                      key={lesson.lesson_id}
                      className={`flex items-start gap-3 rounded-xl border p-3 ${
                        lesson.is_completed
                          ? 'border-[#24dfba]/25 bg-[#24dfba]/5'
                          : 'border-[#253047] bg-[#070d19]'
                      }`}
                    >
                      <span className={`material-symbols-outlined mt-0.5 text-[21px] ${lesson.is_completed ? 'text-[#24dfba]' : 'text-[#657188]'}`}>
                        {lesson.is_completed ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] uppercase text-[#657188]">Bài {lesson.order_index}</p>
                        <h4 className="mt-1 break-words text-[14px] font-bold text-[#e7ecff]">{lesson.title}</h4>
                        <p className="mt-1 text-[11px] text-[#8f9bb3]">
                          {lesson.is_completed ? `Hoàn thành ${formatDateTime(lesson.completed_at)}` : 'Chưa hoàn thành'}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-[#253047] bg-[#111827]">
              <div className="border-b border-[#253047] px-5 py-4">
                <h3 className="text-[19px] font-extrabold text-white">Kết quả và chi tiết làm quiz</h3>
                <p className="mt-1 text-[13px] text-[#8f9bb3]">Mở từng lượt làm để xem câu trả lời, đáp án đúng và số điểm.</p>
              </div>

              {!report.quiz_progress.attempts.length ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-[42px] text-[#657188]">quiz</span>
                  <p className="mt-2 text-[#b8c1d6]">Học viên chưa làm quiz nào trong khóa học.</p>
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  {report.quiz_progress.attempts.map((attempt) => (
                    <details key={attempt.attempt_id} className="group overflow-hidden rounded-xl border border-[#354055] bg-[#070d19]">
                      <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 transition hover:bg-[#151e2d] sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="break-words text-[16px] font-bold text-white">{attempt.quiz_title}</h4>
                            {attempt.difficulty && (
                              <span className="rounded-full border border-[#adc7ff]/25 bg-[#adc7ff]/10 px-2 py-0.5 font-mono text-[10px] text-[#adc7ff]">
                                {difficultyLabels[attempt.difficulty] ?? attempt.difficulty}
                              </span>
                            )}
                            <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                              attempt.status === 'submitted'
                                ? 'bg-[#24dfba]/10 text-[#24dfba]'
                                : attempt.status === 'in_progress'
                                  ? 'bg-[#ffc080]/10 text-[#ffc080]'
                                  : 'bg-[#ffb4ab]/10 text-[#ffb4ab]'
                            }`}>
                              {attemptStatusLabels[attempt.status]}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-[#8f9bb3]">
                            Bắt đầu {formatDateTime(attempt.started_at)} · {formatDuration(attempt.duration_seconds)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <div className="text-right">
                            <strong className={`block text-[21px] ${attempt.status === 'submitted' ? 'text-[#24dfba]' : 'text-[#8f9bb3]'}`}>
                              {attempt.status === 'submitted' ? `${attempt.score}/${attempt.total_score}` : '—'}
                            </strong>
                            <span className="font-mono text-[10px] text-[#8f9bb3]">
                              {attempt.status === 'submitted' ? `${attempt.score_percent}% · ${attempt.correct_answers}/${attempt.total_questions} câu đúng` : 'Chưa có điểm'}
                            </span>
                          </div>
                          <span className="material-symbols-outlined text-[#8f9bb3] transition group-open:rotate-180">expand_more</span>
                        </div>
                      </summary>

                      <div className="border-t border-[#253047] p-4">
                        {attempt.status !== 'submitted' ? (
                          <p className="rounded-lg bg-[#151e2d] p-4 text-[13px] text-[#b8c1d6]">
                            Lượt làm này chưa được nộp nên chưa có câu trả lời và điểm chi tiết.
                          </p>
                        ) : !attempt.answers.length ? (
                          <p className="rounded-lg bg-[#151e2d] p-4 text-[13px] text-[#b8c1d6]">
                            Lượt làm cũ không có dữ liệu chi tiết câu trả lời.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {attempt.answers.map((answer, index) => (
                              <article
                                key={`${attempt.attempt_id}-${answer.question_id}`}
                                className={`rounded-xl border p-4 ${
                                  answer.is_correct
                                    ? 'border-[#24dfba]/25 bg-[#24dfba]/5'
                                    : 'border-[#ffb4ab]/25 bg-[#ffb4ab]/5'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <h5 className="break-words text-[14px] font-bold leading-6 text-white">
                                    Câu {index + 1}: {answer.question_content}
                                  </h5>
                                  <span className={`shrink-0 font-mono text-[11px] font-bold ${answer.is_correct ? 'text-[#24dfba]' : 'text-[#ffb4ab]'}`}>
                                    {answer.earned_point}/{answer.max_point} điểm
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                  <div className="rounded-lg bg-[#070d19]/80 p-3">
                                    <p className="font-mono text-[10px] uppercase text-[#8f9bb3]">Học viên chọn</p>
                                    <p className={`mt-1 text-[13px] leading-5 ${answer.is_correct ? 'text-[#24dfba]' : 'text-[#ffb4ab]'}`}>
                                      {answer.selected_answers.length
                                        ? answer.selected_answers.map((item) => item.content).join(', ')
                                        : 'Không chọn đáp án'}
                                    </p>
                                  </div>
                                  <div className="rounded-lg bg-[#070d19]/80 p-3">
                                    <p className="font-mono text-[10px] uppercase text-[#8f9bb3]">Đáp án đúng</p>
                                    <p className="mt-1 text-[13px] leading-5 text-[#24dfba]">
                                      {answer.correct_answers.length
                                        ? answer.correct_answers.map((item) => item.content).join(', ')
                                        : 'Không có snapshot đáp án'}
                                    </p>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
