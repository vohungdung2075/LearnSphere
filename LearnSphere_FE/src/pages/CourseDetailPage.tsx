import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { RoleSidebar } from '../components/RoleSidebar';
import { SphereAIButton } from '../components/SphereAIButton';
import { canManageContent, getRoleNav, isCourseOwner } from '../lib/roleAccess';
import { api, getStoredUser, type Course, type CourseProgress, type Enrollment, type Lesson } from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAK3DeXFfcU7eoLcYm0J-P0geFc_1SNB3sOpbZdSgXNGYGNkWLvpydHgoO3teNd6SCKCfYzJzNrs1AB7P8Pu74X-3istluRsHM1oPvbEs2nLPM2cHWOxHmwakxXKAZY99rZGG-p9kypULkAvH9bkTxwS1EgNluYqYhNlGpql2gZkqIWaOYk5FWOQvYjhFI2VJivahYgEOwamgFB5MZtSI9a-fovv-ztHAlZ1TjPwNnEgpB773mBUptA6A';

function getRoleLabel(role?: string) {
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'tutor') return 'Giảng viên';
  if (role === 'student') return 'Học viên';
  return 'Khách';
}

function getCreatorName(course: Course | null) {
  if (!course?.created_by) return 'Chưa cập nhật';
  return typeof course.created_by === 'object' ? course.created_by.full_name : 'Giảng viên LearnSphere';
}

export function CourseDetailPage() {
  const courseId = new URLSearchParams(window.location.search).get('course_id');
  const user = getStoredUser();
  const navItems = useMemo(() => getRoleNav(user), [user]);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<Enrollment['status'] | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [canViewLessons, setCanViewLessons] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [message, setMessage] = useState('');

  async function loadCourse() {
    if (!courseId) {
      setMessage('Thiếu mã khóa học.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMessage('');
    try {
      const courseResult = await api.getCourse(courseId);
      setCourse(courseResult);

      if (courseResult.thumbnail_key) {
        api.getCourseThumbnail(courseId)
          .then((result) => setThumbnailUrl(result.download_url))
          .catch(() => setThumbnailUrl(''));
      } else {
        setThumbnailUrl('');
      }

      let lessonAccess = user?.role === 'admin' || (user?.role === 'tutor' && isCourseOwner(user, courseResult));

      if (user?.role === 'student') {
        const enrollments = await api.getMyCourses();
        const enrollment = enrollments.find((item) => {
          const enrolledCourseId = typeof item.course_id === 'string' ? item.course_id : item.course_id._id;
          return enrolledCourseId === courseId;
        });
        const status = enrollment?.status ?? null;
        setEnrollmentStatus(status);
        lessonAccess = status === 'active';

        if (lessonAccess) {
          api.getCourseProgress(courseId).then(setProgress).catch(() => setProgress(null));
        } else {
          setProgress(null);
        }
      }

      setCanViewLessons(lessonAccess);
      if (lessonAccess) {
        const lessonItems = await api.getLessons(courseId);
        setLessons(lessonItems);
      } else {
        setLessons([]);
      }
    } catch (error) {
      setCourse(null);
      setLessons([]);
      setMessage(error instanceof Error ? error.message : 'Không thể tải thông tin khóa học.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCourse();
  }, [courseId]);

  async function handleEnroll() {
    if (!courseId || isEnrolling || user?.role !== 'student') return;
    setIsEnrolling(true);
    setMessage('');
    try {
      const result = await api.enrollCourse(courseId);
      setMessage(result.message);
      await loadCourse();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể đăng ký khóa học.');
    } finally {
      setIsEnrolling(false);
    }
  }

  const progressPercent = progress?.progress_percent ?? 0;
  const isCourseManager = Boolean(course && (user?.role === 'admin' || (canManageContent(user) && isCourseOwner(user, course))));

  return (
    <div className="min-h-screen bg-[#070d19] text-[#e7ecff]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <RoleSidebar activePath="/courses" items={navItems} user={user} />
      <AppToast message={message} tone={message.startsWith('Đang ') ? 'loading' : 'warning'} onClose={() => setMessage('')} />

      <main className="min-h-screen px-4 pb-16 pt-6 md:ml-64 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <nav className="flex flex-wrap items-center gap-2 font-mono text-[12px] text-[#8b90a0]">
            <a className="transition hover:text-[#adc7ff]" href="/courses">Khóa học</a>
            <span className="material-symbols-outlined text-[15px]">chevron_right</span>
            <span className="text-[#dce5f7]">Thông tin khóa học</span>
          </nav>

          {isLoading && (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-[#253047] bg-[#111827]">
              <div className="text-center">
                <span className="material-symbols-outlined animate-spin text-[42px] text-[#adc7ff]">progress_activity</span>
                <p className="mt-3 font-mono text-[12px] text-[#8b90a0]">Đang tải thông tin khóa học...</p>
              </div>
            </div>
          )}

          {!isLoading && !course && (
            <section className="rounded-2xl border border-dashed border-[#354055] bg-[#111827] p-10 text-center">
              <span className="material-symbols-outlined text-[50px] text-[#8b90a0]">school</span>
              <h1 className="mt-3 text-[24px] font-bold">Không tìm thấy khóa học</h1>
              <a className="mt-6 inline-flex rounded-xl bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68]" href="/courses">Quay lại danh sách</a>
            </section>
          )}

          {!isLoading && course && (
            <>
              <section className="relative min-h-[440px] overflow-hidden rounded-3xl border border-white/15 bg-[#111827] shadow-2xl shadow-black/30">
                <div className="absolute inset-0">
                  {thumbnailUrl ? (
                    <div className="h-full w-full bg-cover bg-center opacity-75" style={{ backgroundImage: `url(${thumbnailUrl})` }} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_25%_20%,rgba(173,199,255,0.3),transparent_35%),linear-gradient(145deg,#101a2b,#202d43)]">
                      <span className="material-symbols-outlined text-[120px] text-[#adc7ff]/20">school</span>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-[#050a13]/95 via-[#07101c]/75 to-[#07101c]/25" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050911]/95 via-transparent to-[#050911]/20" />

                <div className="relative z-10 flex min-h-[440px] max-w-3xl flex-col justify-end p-6 md:p-10">
                  <div className="mb-5 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#07101a]/65 px-3 py-1.5 font-mono text-[11px] font-bold text-[#ffd29a] backdrop-blur-md">
                      <span className="material-symbols-outlined text-[15px]">{course.enrollment_type === 'approval_required' ? 'verified_user' : 'bolt'}</span>
                      {course.enrollment_type === 'approval_required' ? 'Đăng ký cần duyệt' : 'Đăng ký mở'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#07101a]/65 px-3 py-1.5 font-mono text-[11px] font-bold text-[#b9f4e5] backdrop-blur-md">
                      <span className="material-symbols-outlined text-[15px]">person</span>
                      {getCreatorName(course)}
                    </span>
                  </div>

                  <h1 className="text-[34px] font-black leading-tight text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.9)] md:text-[48px]">{course.title}</h1>
                  <p className="mt-4 max-w-2xl whitespace-pre-wrap text-[15px] leading-7 text-white/85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] md:text-[17px]">
                    {course.description || 'Khóa học này chưa có phần giới thiệu chi tiết.'}
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">
                    {user?.role === 'student' && enrollmentStatus === 'active' && (
                      <a className="inline-flex items-center gap-2 rounded-xl bg-[#c5d9ff] px-5 py-3 font-mono text-[12px] font-black uppercase text-[#002b62] transition hover:brightness-110" href="#lesson-list">
                        <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                        Chọn bài học
                      </a>
                    )}
                    {user?.role === 'student' && enrollmentStatus === 'pending' && (
                      <button className="cursor-not-allowed rounded-xl border border-[#ffd29a]/40 bg-[#07101a]/70 px-5 py-3 font-mono text-[12px] font-bold text-[#ffd29a] backdrop-blur" type="button" disabled>
                        Đang chờ giảng viên duyệt
                      </button>
                    )}
                    {user?.role === 'student' && !enrollmentStatus && (
                      <button className="inline-flex items-center gap-2 rounded-xl bg-[#24dfba] px-5 py-3 font-mono text-[12px] font-black uppercase text-[#00382c] transition hover:brightness-110 disabled:opacity-60" type="button" disabled={isEnrolling} onClick={() => void handleEnroll()}>
                        <span className="material-symbols-outlined text-[18px]">school</span>
                        {isEnrolling ? 'Đang đăng ký...' : 'Đăng ký khóa học'}
                      </button>
                    )}
                    {isCourseManager && (
                      <a className="inline-flex items-center gap-2 rounded-xl bg-[#c5d9ff] px-5 py-3 font-mono text-[12px] font-black uppercase text-[#002b62] transition hover:brightness-110" href={`/lesson-management?course_id=${encodeURIComponent(course._id)}`}>
                        <span className="material-symbols-outlined text-[18px]">settings</span>
                        Quản lý khóa học
                      </a>
                    )}
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-3">
                <article className="rounded-2xl border border-[#253047] bg-[#111827] p-5">
                  <span className="material-symbols-outlined text-[27px] text-[#adc7ff]">menu_book</span>
                  <p className="mt-3 text-[27px] font-bold">{canViewLessons ? lessons.length : '—'}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Bài học</p>
                </article>
                <article className="rounded-2xl border border-[#253047] bg-[#111827] p-5">
                  <span className="material-symbols-outlined text-[27px] text-[#24dfba]">trending_up</span>
                  <p className="mt-3 text-[27px] font-bold">{user?.role === 'student' && enrollmentStatus === 'active' ? `${progressPercent}%` : '—'}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Tiến độ của bạn</p>
                </article>
                <article className="rounded-2xl border border-[#253047] bg-[#111827] p-5">
                  <span className="material-symbols-outlined text-[27px] text-[#ffd29a]">how_to_reg</span>
                  <p className="mt-3 text-[18px] font-bold">{course.enrollment_type === 'approval_required' ? 'Cần duyệt' : 'Mở'}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Hình thức đăng ký</p>
                </article>
              </section>

              <section id="lesson-list" className="scroll-mt-24 rounded-2xl border border-[#253047] bg-[#111827] p-5 shadow-xl shadow-black/20 md:p-7">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#24dfba]">Nội dung khóa học</p>
                    <h2 className="mt-2 text-[28px] font-bold">Chọn bài học</h2>
                    <p className="mt-2 text-[14px] text-[#aeb8cc]">Bạn có thể bắt đầu hoặc quay lại bất kỳ bài học nào trong danh sách.</p>
                  </div>
                  {canViewLessons && <span className="rounded-full border border-[#adc7ff]/25 bg-[#adc7ff]/10 px-3 py-1.5 font-mono text-[11px] text-[#adc7ff]">{lessons.length} bài</span>}
                </div>

                {!canViewLessons && (
                  <div className="rounded-xl border border-dashed border-[#354055] bg-[#080e1a] p-7 text-center">
                    <span className="material-symbols-outlined text-[40px] text-[#8b90a0]">lock</span>
                    <h3 className="mt-2 text-[18px] font-bold">Danh sách bài học đang được khóa</h3>
                    <p className="mt-2 text-[14px] leading-6 text-[#8b90a0]">Học viên cần đăng ký và được duyệt trước khi xem nội dung bài học.</p>
                  </div>
                )}

                {canViewLessons && !lessons.length && (
                  <div className="rounded-xl border border-dashed border-[#354055] bg-[#080e1a] p-7 text-center text-[#aeb8cc]">Khóa học chưa có bài học.</div>
                )}

                {canViewLessons && lessons.length > 0 && (
                  <div className="space-y-3">
                    {lessons.map((lesson, index) => (
                      <a
                        key={lesson._id}
                        className="group/lesson flex items-center gap-4 rounded-xl border border-[#253047] bg-[#080e1a] p-4 transition hover:border-[#adc7ff]/45 hover:bg-[#121d2e]"
                        href={`/lesson-detail?course_id=${encodeURIComponent(course._id)}&lesson_id=${encodeURIComponent(lesson._id)}`}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#adc7ff]/20 bg-[#adc7ff]/10 font-mono text-[13px] font-black text-[#adc7ff]">{String(index + 1).padStart(2, '0')}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-bold text-[#e7ecff] group-hover/lesson:text-[#adc7ff]">{lesson.title}</span>
                          <span className="mt-1 block font-mono text-[11px] text-[#8b90a0]">Bài {lesson.order_index} · Video và tài liệu học tập</span>
                        </span>
                        <span className="material-symbols-outlined shrink-0 text-[#8b90a0] transition group-hover/lesson:translate-x-1 group-hover/lesson:text-[#adc7ff]">arrow_forward</span>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {courseId && <SphereAIButton href={`/ai-assistant?course_id=${encodeURIComponent(courseId)}`} />}
    </div>
  );
}
