import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { RoleSidebar } from '../components/RoleSidebar';
import { SphereAIButton } from '../components/SphereAIButton';
import { getRoleLabel, getRoleNav } from '../lib/roleAccess';
import { api, getStoredUser, type Course, type CourseProgress, type Enrollment } from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAK3DeXFfcU7eoLcYm0J-P0geFc_1SNB3sOpbZdSgXNGYGNkWLvpydHgoO3teNd6SCKCfYzJzNrs1AB7P8Pu74X-3istluRsHM1oPvbEs2nLPM2cHWOxHmwakxXKAZY99rZGG-p9kypULkAvH9bkTxwS1EgNluYqYhNlGpql2gZkqIWaOYk5FWOQvYjhFI2VJivahYgEOwamgFB5MZtSI9a-fovv-ztHAlZ1TjPwNnEgpB773mBUptA6A';
const fallbackCourseImage =
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1400&q=80';

type CourseStatusFilter = 'all' | 'active' | 'pending' | 'completed';
type SortMode = 'recent' | 'progress' | 'title';

function getCourseHref(courseId: string) {
  return `/course-detail?course_id=${encodeURIComponent(courseId)}`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

export function MyCoursesPage() {
  const user = getStoredUser();
  const navItems = useMemo(() => getRoleNav(user), [user]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progressByCourseId, setProgressByCourseId] = useState<Record<string, CourseProgress>>({});
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CourseStatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [unenrollingCourseId, setUnenrollingCourseId] = useState('');

  async function loadMyCourses({ silent = false } = {}) {
    if (!silent) {
      setIsLoading(true);
      setMessage('');
    }

    try {
      const items = await api.getMyCourses();
      const courseItems = items.filter((enrollment) => typeof enrollment.course_id !== 'string');
      const activeCourseIds = courseItems
        .filter((enrollment) => enrollment.status === 'active')
        .map((enrollment) => (enrollment.course_id as Course)._id);

      const [progressItems, thumbnailItems] = await Promise.all([
        Promise.all(
          activeCourseIds.map(async (courseId) => {
            try {
              return [courseId, await api.getCourseProgress(courseId)] as const;
            } catch {
              return null;
            }
          }),
        ),
        Promise.all(
          courseItems
            .map((enrollment) => enrollment.course_id as Course)
            .filter((course) => course.thumbnail_key)
            .map(async (course) => {
              try {
                const result = await api.getCourseThumbnail(course._id);
                return [course._id, result.download_url] as const;
              } catch {
                return null;
              }
            }),
        ),
      ]);

      setEnrollments(items);
      setProgressByCourseId(Object.fromEntries(progressItems.filter(Boolean) as Array<readonly [string, CourseProgress]>));
      setThumbnailUrls(Object.fromEntries(thumbnailItems.filter(Boolean) as Array<readonly [string, string]>));
    } catch (err) {
      if (!silent) setMessage(err instanceof Error ? err.message : 'Không thể tải khóa học của tôi');
      setEnrollments([]);
      setProgressByCourseId({});
      setThumbnailUrls({});
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMyCourses();
    const intervalId = window.setInterval(() => {
      void loadMyCourses({ silent: true });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  const courses = useMemo(
    () =>
      enrollments
        .filter((enrollment) => typeof enrollment.course_id !== 'string')
        .map((enrollment) => {
          const course = enrollment.course_id as Course;
          const progress = progressByCourseId[course._id];
          return {
            id: course._id,
            title: course.title,
            description: course.description || 'Chưa có mô tả.',
            creator: typeof course.created_by === 'object' ? course.created_by.full_name : 'Chưa rõ',
            enrollmentCount: course.enrollment_count ?? 0,
            status: enrollment.status,
            requestedAt: enrollment.requested_at,
            approvedAt: enrollment.approved_at,
            thumbnailUrl: thumbnailUrls[course._id],
            progress,
            progressPercent: enrollment.status === 'active' ? progress?.progress_percent ?? 0 : 0,
          };
        }),
    [enrollments, progressByCourseId, thumbnailUrls],
  );

  const stats = useMemo(() => {
    const active = courses.filter((course) => course.status === 'active').length;
    const pending = courses.filter((course) => course.status === 'pending').length;
    const completed = courses.filter((course) => course.status === 'active' && course.progressPercent >= 100).length;
    const averageProgress = active
      ? Math.round(courses.filter((course) => course.status === 'active').reduce((total, course) => total + course.progressPercent, 0) / active)
      : 0;

    return { active, pending, completed, averageProgress };
  }, [courses]);

  const visibleCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = courses.filter((course) => {
      const matchesQuery =
        !normalizedQuery ||
        course.title.toLowerCase().includes(normalizedQuery) ||
        course.description.toLowerCase().includes(normalizedQuery) ||
        course.creator.toLowerCase().includes(normalizedQuery);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'completed' ? course.status === 'active' && course.progressPercent >= 100 : course.status === statusFilter);

      return matchesQuery && matchesStatus;
    });

    return [...filtered].sort((first, second) => {
      if (sortMode === 'title') return first.title.localeCompare(second.title, 'vi');
      if (sortMode === 'progress') return second.progressPercent - first.progressPercent;
      return (second.approvedAt ?? second.requestedAt ?? '').localeCompare(first.approvedAt ?? first.requestedAt ?? '');
    });
  }, [courses, query, sortMode, statusFilter]);

  const featuredCourse = courses.find((course) => course.status === 'active') ?? courses[0];
  const featuredImage = featuredCourse?.thumbnailUrl || fallbackCourseImage;

  async function handleUnenroll(courseId: string, status: Enrollment['status']) {
    const confirmed = window.confirm(
      status === 'pending'
        ? 'Hủy yêu cầu đăng ký khóa học này?'
        : 'Rời khóa học này? Bạn sẽ mất quyền truy cập, nhưng tiến độ và lịch sử quiz vẫn được giữ.',
    );
    if (!confirmed) return;

    setUnenrollingCourseId(courseId);
    try {
      const result = await api.unenrollCourse(courseId);
      setMessage(result.message);
      await loadMyCourses();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể hủy đăng ký khóa học');
    } finally {
      setUnenrollingCourseId('');
    }
  }

  return (
    <div className="min-h-screen bg-[#0d131f] text-[#dde2f4] selection:bg-[#4a8eff] selection:text-[#00285b]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <RoleSidebar activePath="/my-courses" items={navItems} user={user} />
      <AppToast message={message} tone="warning" onClose={() => setMessage('')} />

      <main className="min-h-screen pb-24 md:pl-64">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
          <section className="relative overflow-hidden rounded-xl border border-white/5 bg-[#242a37] shadow-card">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${featuredImage})` }} />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#0d131f_0%,rgba(13,19,31,0.9)_45%,rgba(13,19,31,0.2)_100%)]" />
            <div className="relative z-10 flex min-h-[300px] max-w-3xl flex-col justify-center px-6 py-8 md:px-10">
              <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#24dfba]/25 bg-[#24dfba]/10 px-3 py-1 font-mono text-[12px] font-bold uppercase tracking-wide text-[#24dfba]">
                <span className="material-symbols-outlined text-[16px]">menu_book</span>
                Lộ trình của tôi
              </span>
              <h1 className="text-[36px] font-bold leading-tight md:text-[48px]">Khóa học của tôi</h1>
              <p className="mt-4 max-w-2xl text-[16px] leading-7 text-[#c1c6d7]">
                Theo dõi các khóa đã đăng ký, tiến độ bài học và tiếp tục học từ đúng nơi bạn đang dừng lại.
              </p>
              <div className="mt-7 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: 'Đang học', value: stats.active, tone: 'text-[#24dfba]' },
                  { label: 'Chờ duyệt', value: stats.pending, tone: 'text-[#ffc080]' },
                  { label: 'Hoàn thành', value: stats.completed, tone: 'text-[#adc7ff]' },
                  { label: 'Tiến độ TB', value: `${stats.averageProgress}%`, tone: 'text-[#d5b8ff]' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-[#0d131f]/75 p-3 backdrop-blur">
                    <p className="font-mono text-[11px] uppercase text-[#8b90a0]">{item.label}</p>
                    <strong className={`mt-1 block text-[24px] ${item.tone}`}>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-white/5 bg-[#161c28] p-4 shadow-xl shadow-black/20">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
              <input
                className="h-11 rounded-lg border border-[#414754] bg-[#080e1a] px-4 text-[14px] text-[#dde2f4] outline-none placeholder:text-[#8b90a0] focus:border-[#adc7ff]"
                placeholder="Tìm khóa học của tôi..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'Tất cả' },
                  { value: 'active', label: 'Đang học' },
                  { value: 'pending', label: 'Chờ duyệt' },
                  { value: 'completed', label: 'Hoàn thành' },
                ].map((item) => (
                  <button
                    key={item.value}
                    className={`rounded-lg px-4 py-2.5 font-mono text-[12px] font-bold transition ${
                      statusFilter === item.value
                        ? 'bg-[#adc7ff] text-[#00285b]'
                        : 'border border-[#414754] bg-[#0d131f] text-[#c1c6d7] hover:border-[#adc7ff]/60 hover:text-[#adc7ff]'
                    }`}
                    type="button"
                    onClick={() => setStatusFilter(item.value as CourseStatusFilter)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <select
                className="h-11 rounded-lg border border-[#414754] bg-[#080e1a] px-4 font-mono text-[12px] font-bold text-[#dde2f4] outline-none focus:border-[#adc7ff]"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="recent">Mới cập nhật</option>
                <option value="progress">Tiến độ cao nhất</option>
                <option value="title">Tên A-Z</option>
              </select>
            </div>
          </section>

          {isLoading && (
            <div className="rounded-lg border border-white/5 bg-[#161c28] px-4 py-3 font-mono text-[12px] text-[#ffc080]">
              Đang tải khóa học của tôi...
            </div>
          )}

          {!isLoading && !visibleCourses.length && (
            <section className="rounded-xl border border-dashed border-[#414754] bg-[#161c28] p-10 text-center">
              <span className="material-symbols-outlined mb-3 text-[48px] text-[#8b90a0]">school</span>
              <h2 className="text-[24px] font-semibold">Chưa có khóa học phù hợp</h2>
              <p className="mt-2 text-[#8b90a0]">Thử đổi bộ lọc hoặc khám phá thêm khóa học mới.</p>
              <a className="mt-5 inline-flex rounded-lg bg-[#adc7ff] px-5 py-3 font-mono text-[12px] font-bold text-[#002e68]" href="/courses">
                Khám phá khóa học
              </a>
            </section>
          )}

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {visibleCourses.map((course) => {
              const isActive = course.status === 'active';
              const href = getCourseHref(course.id);

              return (
                <article key={course.id} className="group flex min-h-[460px] flex-col overflow-hidden rounded-xl border border-white/5 bg-[#1a202c] shadow-xl shadow-black/20 transition hover:border-[#adc7ff]/35">
                  <a
                    className="relative block aspect-video overflow-hidden bg-[#242a37]"
                    href={isActive ? href : '#'}
                    onClick={(event) => {
                      if (!isActive) event.preventDefault();
                    }}
                  >
                    <div
                      className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${course.thumbnailUrl || fallbackCourseImage})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d131f]/80 to-transparent" />
                    <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-[#0d131f]/90 px-3 py-1.5 font-mono text-[11px] font-bold backdrop-blur ${isActive ? 'text-[#24dfba]' : 'text-[#ffc080]'}`}>
                      <span className="material-symbols-outlined text-[15px]">{isActive ? 'play_circle' : 'schedule'}</span>
                      {isActive ? 'Đang học' : 'Chờ duyệt'}
                    </span>
                  </a>

                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="line-clamp-2 text-[22px] font-semibold leading-7 text-[#dde2f4] transition group-hover:text-[#adc7ff]">{course.title}</h3>
                    <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-[#c1c6d7]">{course.description}</p>

                    <div className="mt-5 rounded-xl border border-[#253047] bg-[#080e1a] p-4">
                      <div className="mb-2 flex items-center justify-between font-mono text-[12px]">
                        <span className="uppercase tracking-wide text-[#8b90a0]">Tiến trình</span>
                        <strong className={course.progressPercent >= 100 ? 'text-[#adc7ff]' : 'text-[#24dfba]'}>{course.progressPercent}%</strong>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#263145]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#24dfba] to-[#adc7ff] transition-all duration-500" style={{ width: `${course.progressPercent}%` }} />
                      </div>
                      <p className="mt-2 font-mono text-[11px] text-[#8b90a0]">
                        {isActive && course.progress
                          ? `${course.progress.completed_lessons}/${course.progress.total_lessons} bài học đã hoàn thành`
                          : `Đã gửi đăng ký ngày ${formatDate(course.requestedAt)}`}
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 font-mono text-[11px]">
                      <div className="rounded-lg bg-[#080e1a] p-3">
                        <p className="text-[#8b90a0]">Người tạo</p>
                        <p className="mt-1 truncate text-[#dde2f4]">{course.creator}</p>
                      </div>
                      <div className="rounded-lg bg-[#080e1a] p-3">
                        <p className="text-[#8b90a0]">Ngày duyệt</p>
                        <p className="mt-1 text-[#dde2f4]">{formatDate(course.approvedAt)}</p>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#8b90a0]">
                        <span className="material-symbols-outlined text-[15px]">groups</span>
                        {course.enrollmentCount} học viên
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ffb4ab]/35 px-3 py-3 font-mono text-[11px] font-bold text-[#ffb4ab] transition hover:bg-[#ffb4ab]/10 disabled:cursor-wait disabled:opacity-60"
                          type="button"
                          disabled={unenrollingCourseId === course.id}
                          onClick={() => void handleUnenroll(course.id, course.status)}
                        >
                          <span className="material-symbols-outlined text-[16px]">logout</span>
                          {unenrollingCourseId === course.id
                            ? 'Đang xử lý...'
                            : isActive
                              ? 'Rời khóa'
                              : 'Hủy yêu cầu'}
                        </button>
                        <a
                          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-mono text-[12px] font-bold transition ${
                            isActive
                              ? 'bg-[#adc7ff] text-[#002e68] hover:brightness-110'
                              : 'pointer-events-none border border-[#ffc080]/30 bg-[#ffc080]/10 text-[#ffc080]'
                          }`}
                          href={isActive ? href : '#'}
                        >
                          <span className="material-symbols-outlined text-[17px]">{isActive ? 'play_arrow' : 'hourglass_top'}</span>
                          {isActive ? 'Vào học' : 'Chờ duyệt'}
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </main>

      <SphereAIButton />
    </div>
  );
}
