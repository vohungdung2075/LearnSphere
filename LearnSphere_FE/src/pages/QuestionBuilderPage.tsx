import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { RoleSidebar } from '../components/RoleSidebar';
import { SphereAIButton } from '../components/SphereAIButton';
import { canManageSystem, getRoleLabel, getRoleNav, isCourseOwner } from '../lib/roleAccess';
import { api, getStoredUser, type Course, type QuestionInput, type Quiz, type QuizQuestion } from '../services/api';

type QuestionForm = {
  content: string;
  question_type: QuestionInput['question_type'];
  point: string;
  answers: Array<{ content: string; is_correct: boolean }>;
};

type QuizForm = {
  title: string;
  description: string;
  time_limit: string;
};

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDKeNBi2jNgbEX4dt6nsH8jJ0KsxzOaxqx2_3cWyMw1EojZOMGx8vJ8ZLFtsLYzqvQb9_dSiLClGrvSO4CC2JllO5YZHuHqUbvV1MSBNYm-i0rDvPn2F8A7NYDrALUHOW7B91ZePrzuoy9OH-pfMu7ItzDyGaJdG859kW0r_EFrTL9AHdLIPJAgzWL8CGrqQxQvMwNXzlmKUYlEHjOyGdInGpJkYNSHYPbXj6hVa42TveS95tPWoVIQhA';

const emptyQuestionForm: QuestionForm = {
  content: '',
  question_type: 'single_choice',
  point: '1',
  answers: [
    { content: '', is_correct: true },
    { content: '', is_correct: false },
  ],
};

const emptyQuizForm: QuizForm = {
  title: '',
  description: '',
  time_limit: '15',
};

function normalizeQuestionForm(form: QuestionForm): QuestionInput {
  return {
    content: form.content.trim(),
    question_type: form.question_type,
    point: Number(form.point),
    answers: form.answers.map((answer) => ({
      content: answer.content.trim(),
      is_correct: answer.is_correct,
    })),
  };
}

function getQuestionTypeLabel(type: QuizQuestion['question_type']) {
  return type === 'single_choice' ? 'Một đáp án' : 'Nhiều đáp án';
}

export function QuestionBuilderPage() {
  const params = new URLSearchParams(window.location.search);
  const initialCourseId = params.get('course_id') ?? '';
  const initialQuizId = params.get('quiz_id') ?? '';
  const user = getStoredUser();
  const navItems = getRoleNav(user);
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId);
  const [selectedQuizId, setSelectedQuizId] = useState(initialQuizId);
  const [quizForm, setQuizForm] = useState<QuizForm>(emptyQuizForm);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestionForm);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedQuiz = useMemo(() => quizzes.find((quiz) => quiz._id === selectedQuizId), [quizzes, selectedQuizId]);
  const selectedCourse = useMemo(() => courses.find((course) => course._id === selectedCourseId), [courses, selectedCourseId]);
  const canEditQuizDetail = user?.role === 'tutor';

  useEffect(() => {
    if (!canEditQuizDetail) return;

    setIsLoadingCourses(true);
    api.getCourses()
      .then((items) => {
        const ownCourses = items.filter((course) => isCourseOwner(user, course));
        setCourses(ownCourses);
        if (!selectedCourseId && ownCourses[0]) {
          setSelectedCourseId(ownCourses[0]._id);
        }
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Không thể tải khóa học'))
      .finally(() => setIsLoadingCourses(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEditQuizDetail, user?.id, user?._id]);

  useEffect(() => {
    if (!selectedCourseId) {
      setQuizzes([]);
      setSelectedQuizId('');
      return;
    }

    setIsLoadingQuizzes(true);
    setMessage('');
    api.getCourseQuizzes(selectedCourseId)
      .then((items) => {
        setQuizzes(items);
        const nextQuizId = items.some((quiz) => quiz._id === selectedQuizId) ? selectedQuizId : items[0]?._id ?? '';
        setSelectedQuizId(nextQuizId);
      })
      .catch((err) => {
        setQuizzes([]);
        setSelectedQuizId('');
        setMessage(err instanceof Error ? err.message : 'Không thể tải quiz của khóa học');
      })
      .finally(() => setIsLoadingQuizzes(false));
  }, [selectedCourseId, selectedQuizId]);

  useEffect(() => {
    if (!selectedQuizId) {
      setQuestions([]);
      return;
    }

    setIsLoadingQuestions(true);
    api.getQuizQuestions(selectedQuizId)
      .then(setQuestions)
      .catch((err) => {
        setQuestions([]);
        setMessage(err instanceof Error ? err.message : 'Không thể tải câu hỏi trong quiz');
      })
      .finally(() => setIsLoadingQuestions(false));
  }, [selectedQuizId]);

  function updateCorrectAnswer(index: number, checked: boolean) {
    setQuestionForm((current) => ({
      ...current,
      answers: current.answers.map((answer, answerIndex) => {
        if (current.question_type === 'single_choice') {
          return { ...answer, is_correct: answerIndex === index };
        }

        return answerIndex === index ? { ...answer, is_correct: checked } : answer;
      }),
    }));
  }

  function updateQuestionType(question_type: QuestionForm['question_type']) {
    setQuestionForm((current) => ({
      ...current,
      question_type,
      answers: question_type === 'single_choice'
        ? current.answers.map((answer, index) => ({ ...answer, is_correct: index === 0 }))
        : current.answers,
    }));
  }

  function addAnswer() {
    setQuestionForm((current) => ({
      ...current,
      answers: [...current.answers, { content: '', is_correct: false }],
    }));
  }

  function removeAnswer(index: number) {
    setQuestionForm((current) => {
      if (current.answers.length <= 2) return current;

      const answers = current.answers.filter((_, answerIndex) => answerIndex !== index);
      if (!answers.some((answer) => answer.is_correct)) {
        answers[0] = { ...answers[0], is_correct: true };
      }

      return { ...current, answers };
    });
  }

  async function loadQuestions(quizId: string) {
    setIsLoadingQuestions(true);
    try {
      setQuestions(await api.getQuizQuestions(quizId));
    } catch (err) {
      setQuestions([]);
      setMessage(err instanceof Error ? err.message : 'Không thể tải câu hỏi trong quiz');
    } finally {
      setIsLoadingQuestions(false);
    }
  }

  async function handleCreateQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCourseId) {
      setMessage('Vui lòng chọn khóa học trước khi tạo quiz.');
      return;
    }

    if (!quizForm.title.trim()) {
      setMessage('Vui lòng nhập tên quiz.');
      return;
    }

    const timeLimit = Number(quizForm.time_limit);
    if (!timeLimit || timeLimit <= 0) {
      setMessage('Thời lượng quiz phải lớn hơn 0.');
      return;
    }

    setIsCreatingQuiz(true);
    try {
      const result = await api.createQuiz(selectedCourseId, {
        title: quizForm.title.trim(),
        description: quizForm.description.trim() || undefined,
        time_limit: timeLimit,
      });
      setMessage(result.message);
      setQuizForm(emptyQuizForm);
      const nextQuizzes = await api.getCourseQuizzes(selectedCourseId);
      setQuizzes(nextQuizzes);
      setSelectedQuizId(result.quiz._id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể tạo quiz');
    } finally {
      setIsCreatingQuiz(false);
    }
  }

  async function handleCreateQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedQuizId) {
      setMessage('Vui lòng chọn quiz cần tạo câu hỏi.');
      return;
    }

    const payload = normalizeQuestionForm(questionForm);
    const filledAnswers = payload.answers.filter((answer) => answer.content);
    const correctAnswers = filledAnswers.filter((answer) => answer.is_correct);

    if (!payload.content) {
      setMessage('Vui lòng nhập nội dung câu hỏi.');
      return;
    }

    if (!payload.point || payload.point <= 0) {
      setMessage('Điểm câu hỏi phải lớn hơn 0.');
      return;
    }

    if (filledAnswers.length < 2) {
      setMessage('Mỗi câu hỏi cần ít nhất 2 đáp án.');
      return;
    }

    if (payload.question_type === 'single_choice' && correctAnswers.length !== 1) {
      setMessage('Câu hỏi một đáp án cần đúng đúng 1 đáp án.');
      return;
    }

    if (payload.question_type === 'multiple_choice' && !correctAnswers.length) {
      setMessage('Câu hỏi nhiều đáp án cần ít nhất 1 đáp án đúng.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.createQuizQuestion(selectedQuizId, { ...payload, answers: filledAnswers });
      setMessage(result.message);
      setQuestionForm(emptyQuestionForm);
      await loadQuestions(selectedQuizId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể tạo câu hỏi');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!selectedQuizId) return;
    const confirmed = window.confirm('Xóa câu hỏi này khỏi quiz?');
    if (!confirmed) return;

    try {
      const result = await api.deleteQuizQuestion(selectedQuizId, questionId);
      setMessage(result.message);
      await loadQuestions(selectedQuizId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể xóa câu hỏi');
    }
  }

  if (!canEditQuizDetail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
        <section className="max-w-md rounded-xl border border-[#414754] bg-[#161c28] p-8 text-center">
          <span className="material-symbols-outlined mb-4 text-[48px] text-[#ffb4ab]">lock</span>
          <h1 className="text-[26px] font-semibold">Không có quyền truy cập</h1>
          <p className="mt-2 text-[#c1c6d7]">Chỉ gia sư được tạo chi tiết quiz cho khóa học do mình sở hữu.</p>
          <a className="mt-6 inline-flex rounded-lg bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68]" href="/dashboard">
            Về bảng điều khiển
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0d131f] text-[#dde2f4]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <AppToast message={message} tone="warning" onClose={() => setMessage('')} />

      <RoleSidebar activePath="/question-builder" items={navItems} user={user} />

      <main className="min-w-0 md:pl-64">
        <div className="grid gap-6 p-6 lg:grid-cols-[380px_1fr]">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#adc7ff]">settings_applications</span>
              <h1 className="text-[24px] font-semibold text-[#dde2f4]">Cài đặt bài kiểm tra</h1>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-white/5 bg-[#161f2e]/80 p-5">
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[12px] uppercase tracking-wider text-[#c1c6d7]">Khóa học liên quan</span>
                <select
                  className="w-full rounded-lg border border-[#414754]/60 bg-[#0d131f] px-4 py-3 text-[#dde2f4]"
                  value={selectedCourseId}
                  onChange={(event) => {
                    setSelectedCourseId(event.target.value);
                    setSelectedQuizId('');
                  }}
                >
                  <option value="">{isLoadingCourses ? 'Đang tải khóa học...' : 'Chọn khóa học'}</option>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>{course.title}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-mono text-[12px] uppercase tracking-wider text-[#c1c6d7]">Quiz cần tạo chi tiết</span>
                <select
                  className="w-full rounded-lg border border-[#414754]/60 bg-[#0d131f] px-4 py-3 text-[#dde2f4]"
                  value={selectedQuizId}
                  onChange={(event) => setSelectedQuizId(event.target.value)}
                  disabled={!selectedCourseId || isLoadingQuizzes}
                >
                  <option value="">{isLoadingQuizzes ? 'Đang tải quiz...' : 'Chọn quiz'}</option>
                  {quizzes.map((quiz) => (
                    <option key={quiz._id} value={quiz._id}>{quiz.title}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <article className="rounded-lg border border-[#414754]/60 bg-[#0d131f] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Thời lượng</p>
                  <p className="mt-2 text-[22px] font-semibold">{selectedQuiz ? `${selectedQuiz.time_limit} phút` : '--'}</p>
                </article>
                <article className="rounded-lg border border-[#414754]/60 bg-[#0d131f] p-4">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Số câu hỏi</p>
                  <p className="mt-2 text-[22px] font-semibold">{questions.length}</p>
                </article>
              </div>

              {!courses.length && !isLoadingCourses && (
                <div className="rounded-lg border border-dashed border-[#414754] p-4 text-[14px] text-[#c1c6d7]">
                  Bạn chưa có khóa học nào để tạo chi tiết quiz.
                </div>
              )}

              {selectedCourse && !quizzes.length && !isLoadingQuizzes && (
                <div className="rounded-lg border border-dashed border-[#414754] p-4 text-[14px] text-[#c1c6d7]">
                  Khóa học này chưa có quiz. Tạo quiz bên dưới để bắt đầu thêm câu hỏi.
                </div>
              )}
            </div>

            <form className="space-y-4 rounded-xl border border-white/5 bg-[#161f2e]/80 p-5" onSubmit={handleCreateQuiz}>
              <h2 className="text-[22px] font-semibold">Tạo quiz</h2>
              <input
                className="w-full rounded-lg border border-[#414754]/60 bg-[#0d131f] px-4 py-3 text-[#dde2f4] outline-none placeholder:text-[#8b90a0] focus:border-[#adc7ff]"
                placeholder="Tên quiz"
                value={quizForm.title}
                onChange={(event) => setQuizForm((current) => ({ ...current, title: event.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-[#414754]/60 bg-[#0d131f] px-4 py-3 text-[#dde2f4] outline-none placeholder:text-[#8b90a0] focus:border-[#adc7ff]"
                placeholder="Mô tả quiz"
                value={quizForm.description}
                onChange={(event) => setQuizForm((current) => ({ ...current, description: event.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-[#414754]/60 bg-[#0d131f] px-4 py-3 text-[#dde2f4] outline-none placeholder:text-[#8b90a0] focus:border-[#adc7ff]"
                type="number"
                min="1"
                placeholder="Thời lượng phút"
                value={quizForm.time_limit}
                onChange={(event) => setQuizForm((current) => ({ ...current, time_limit: event.target.value }))}
              />
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-[#adc7ff] px-5 py-3 font-mono text-[13px] font-bold text-[#00285b] disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={!selectedCourseId || isCreatingQuiz}
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                {isCreatingQuiz ? 'Đang tạo...' : 'Tạo quiz'}
              </button>
            </form>
          </section>

          <section className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#adc7ff]">format_list_bulleted</span>
                <h2 className="text-[24px] font-semibold text-[#dde2f4]">Câu hỏi</h2>
              </div>
              <button
                className="flex items-center gap-2 rounded-lg bg-[#fe9800] px-5 py-2.5 font-bold text-[#643900] transition-all active:scale-95 hover:brightness-110"
                type="button"
                onClick={() => setMessage(canManageSystem(user) ? 'Chức năng tạo tự động chưa sẵn sàng.' : 'Chức năng tạo câu hỏi bằng AI chưa sẵn sàng.')}
              >
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                Tạo bằng AI
              </button>
            </div>

            <form className="space-y-4 rounded-xl border border-white/5 bg-[#161f2e]/80 p-5" onSubmit={handleCreateQuestion}>
              <textarea
                className="min-h-24 w-full rounded-lg border border-[#414754]/60 bg-[#0d131f] px-4 py-3 text-[#dde2f4] outline-none placeholder:text-[#8b90a0] focus:border-[#adc7ff]"
                placeholder="Nội dung câu hỏi"
                value={questionForm.content}
                onChange={(event) => setQuestionForm((current) => ({ ...current, content: event.target.value }))}
              />

              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <label className="flex flex-col gap-2">
                  <span className="font-mono text-[12px] uppercase tracking-wider text-[#c1c6d7]">Loại câu hỏi</span>
                  <select
                    className="rounded-lg border border-[#414754]/60 bg-[#0d131f] px-4 py-3 text-[#dde2f4]"
                    value={questionForm.question_type}
                    onChange={(event) => updateQuestionType(event.target.value as QuestionForm['question_type'])}
                  >
                    <option value="single_choice">Một đáp án đúng</option>
                    <option value="multiple_choice">Nhiều đáp án đúng</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="font-mono text-[12px] uppercase tracking-wider text-[#c1c6d7]">Điểm</span>
                  <input
                    className="rounded-lg border border-[#414754]/60 bg-[#0d131f] px-4 py-3 text-[#dde2f4]"
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={questionForm.point}
                    onChange={(event) => setQuestionForm((current) => ({ ...current, point: event.target.value }))}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-mono text-[12px] uppercase tracking-wider text-[#c1c6d7]">Đáp án</h3>
                  <button className="rounded-lg border border-[#adc7ff]/40 px-3 py-2 font-mono text-[12px] text-[#adc7ff]" type="button" onClick={addAnswer}>
                    Thêm đáp án
                  </button>
                </div>

                {questionForm.answers.map((answer, index) => (
                  <div key={index} className="grid gap-3 rounded-lg border border-[#414754]/50 bg-[#0d131f] p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <input
                      className="min-w-0 rounded-lg border border-[#414754]/60 bg-[#111827] px-4 py-3 text-[#dde2f4] outline-none placeholder:text-[#8b90a0] focus:border-[#adc7ff]"
                      placeholder={`Đáp án ${index + 1}`}
                      value={answer.content}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          answers: current.answers.map((item, itemIndex) => itemIndex === index ? { ...item, content: event.target.value } : item),
                        }))
                      }
                    />
                    <label className="flex items-center gap-2 whitespace-nowrap font-mono text-[12px] text-[#24dfba]">
                      <input
                        type={questionForm.question_type === 'single_choice' ? 'radio' : 'checkbox'}
                        name="correct-answer"
                        checked={answer.is_correct}
                        onChange={(event) => updateCorrectAnswer(index, event.target.checked)}
                      />
                      Đáp án đúng
                    </label>
                    <button className="rounded-lg border border-[#ffb4ab]/40 px-3 py-2 font-mono text-[12px] text-[#ffb4ab]" type="button" onClick={() => removeAnswer(index)}>
                      Xóa
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="inline-flex items-center gap-2 rounded-lg bg-[#adc7ff] px-5 py-3 font-mono text-[13px] font-bold text-[#00285b] disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={!selectedQuizId || isSaving}
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                {isSaving ? 'Đang lưu...' : 'Thêm câu hỏi vào quiz'}
              </button>
            </form>

            <section className="overflow-hidden rounded-xl border border-white/5 bg-[#161f2e]/80">
              <div className="flex items-center justify-between border-b border-[#414754]/50 px-5 py-4">
                <h3 className="text-[20px] font-semibold">{selectedQuiz?.title ?? 'Câu hỏi trong quiz'}</h3>
                {isLoadingQuestions && <span className="font-mono text-[12px] text-[#8b90a0]">Đang tải...</span>}
              </div>

              {!questions.length && !isLoadingQuestions ? (
                <div className="flex flex-col items-center justify-center p-10 text-center">
                  <span className="material-symbols-outlined mb-3 text-[48px] text-[#8b90a0]">quiz</span>
                  <h3 className="text-[24px] font-semibold text-[#dde2f4]">Chưa có câu hỏi nào</h3>
                </div>
              ) : (
                <div className="divide-y divide-[#414754]/40">
                  {questions.map((question, index) => (
                    <article key={question._id} className="p-5">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <p className="mb-2 font-mono text-[12px] text-[#8b90a0]">Câu {index + 1}</p>
                          <h4 className="text-[18px] font-semibold">{question.content}</h4>
                          <p className="mt-1 font-mono text-[12px] text-[#8b90a0]">{getQuestionTypeLabel(question.question_type)} · {question.point} điểm</p>
                        </div>
                        <button className="rounded-lg border border-[#ffb4ab]/40 px-4 py-2 font-mono text-[12px] text-[#ffb4ab]" type="button" onClick={() => void handleDeleteQuestion(question._id)}>
                          Xóa
                        </button>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {question.answers.map((answer) => (
                          <div key={answer._id} className={`rounded-lg border px-3 py-2 text-[14px] ${answer.is_correct ? 'border-[#24dfba]/40 bg-[#24dfba]/10 text-[#24dfba]' : 'border-[#414754]/50 bg-[#0d131f] text-[#c1c6d7]'}`}>
                            {answer.content}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        </div>
      </main>

      <SphereAIButton />
    </div>
  );
}
