import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { SphereAIButton } from '../components/SphereAIButton';
import { RoleSidebar } from '../components/RoleSidebar';
import { getRoleLabel, getRoleNav, type NavItem } from '../lib/roleAccess';
import { api, getStoredUser, type CourseProgress, type Enrollment } from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAK3DeXFfcU7eoLcYm0J-P0geFc_1SNB3sOpbZdSgXNGYGNkWLvpydHgoO3teNd6SCKCfYzJzNrs1AB7P8Pu74X-3istluRsHM1oPvbEs2nLPM2cHWOxHmwakxXKAZY99rZGG-p9kypULkAvH9bkTxwS1EgNluYqYhNlGpql2gZkqIWaOYk5FWOQvYjhFI2VJivahYgEOwamgFB5MZtSI9a-fovv-ztHAlZ1TjPwNnEgpB773mBUptA6A';
const fallbackCourseImage =
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=80';

function formatCourseDate(value?: string | null) {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function getRoleActions(role?: string): NavItem[] {
  if (role === 'admin') {
    return [
      { href: '/admin-users', icon: 'group', label: 'Duyệt tutor' },
      { href: '/courses', icon: 'school', label: 'Quản trị khóa học' },
      { href: '/lesson-management', icon: 'auto_stories', label: 'Quản lý khóa học' },
      { href: '/system-monitoring', icon: 'monitoring', label: 'Giám sát hệ thống' },
    ];
  }

  if (role === 'tutor') {
    return [
      { href: '/courses', icon: 'add_circle', label: 'Tạo khóa học' },
      { href: '/lesson-management', icon: 'auto_stories', label: 'Quản lý khóa học' },
      { href: '/question-builder', icon: 'quiz', label: 'Tạo quiz' },
      { href: '/courses', icon: 'how_to_reg', label: 'Duyệt đăng ký' },
    ];
  }

  return [
    { href: '/courses', icon: 'school', label: 'Khám phá khóa học' },
    { href: '/my-courses', icon: 'menu_book', label: 'Theo dõi tiến độ' },
    { href: '/quiz', icon: 'quiz', label: 'Làm quiz' },
    { href: '/ai-assistant', icon: 'psychology', label: 'Hỏi trợ lý AI' },
  ];
}

export function DashboardPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progressByCourseId, setProgressByCourseId] = useState<Record<string, CourseProgress>>({});
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [message, setMessage] = useState('');
  const user = getStoredUser();
  const navItems = useMemo(() => getRoleNav(user), [user]);
  const roleActions = useMemo(() => getRoleActions(user?.role), [user?.role]);

  useEffect(() => {
    if (user?.role !== 'student') return;

    setIsLoadingCourses(true);
    api.getMyCourses()
      .then(async (items) => {
        setEnrollments(items);
        const courseItems = items.filter((enrollment) => typeof enrollment.course_id !== 'string');
        const activeCourseIds = courseItems
          .filter((enrollment) => enrollment.status === 'active')
          .map((enrollment) => (enrollment.course_id as Exclude<Enrollment['course_id'], string>)._id);

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
              .map((enrollment) => enrollment.course_id as Exclude<Enrollment['course_id'], string>)
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

        setProgressByCourseId(Object.fromEntries(progressItems.filter(Boolean) as Array<readonly [string, CourseProgress]>));
        setThumbnailUrls(Object.fromEntries(thumbnailItems.filter(Boolean) as Array<readonly [string, string]>));
      })
      .catch((err) => {
        setEnrollments([]);
        setProgressByCourseId({});
        setThumbnailUrls({});
        setMessage(err instanceof Error ? err.message : 'Không thể tải khóa học đã đăng ký');
      })
      .finally(() => setIsLoadingCourses(false));
  }, [user?.role]);

  const myCourses = useMemo(
    () =>
      enrollments
        .filter((enrollment) => typeof enrollment.course_id !== 'string')
        .map((enrollment) => {
          const course = enrollment.course_id as Exclude<Enrollment['course_id'], string>;
          return {
            id: course._id,
            title: course.title,
            description: course.description || 'Chưa có mô tả.',
            author: typeof course.created_by === 'object' ? course.created_by.full_name : 'Chưa rõ',
            status: enrollment.status,
            enrollmentCount: course.enrollment_count ?? 0,
            requestedAt: enrollment.requested_at,
            approvedAt: enrollment.approved_at,
            thumbnailUrl: thumbnailUrls[course._id],
            progress: progressByCourseId[course._id],
          };
        }),
    [enrollments, progressByCourseId, thumbnailUrls],
  );

  const activeCourses = myCourses.filter((course) => course.status === 'active').length;
  const pendingCourses = myCourses.filter((course) => course.status === 'pending').length;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0d131f] text-[#dde2f4] selection:bg-[#ffc080]/30">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <RoleSidebar activePath="/dashboard" items={navItems} user={user} />
      <AppToast message={message} tone="warning" onClose={() => setMessage('')} />

      <main className="min-h-screen pb-24 md:pl-64">
        <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 p-4 md:p-8">
          <section className="glass-card relative col-span-12 overflow-hidden rounded-xl p-6 lg:col-span-8">
            <div className="relative z-10 max-w-2xl">
              <span className="mb-4 inline-flex rounded-full bg-[#24dfba]/10 px-3 py-1 font-mono text-[12px] font-medium text-[#24dfba]">
                {getRoleLabel(user?.role)}
              </span>
              <h1 className="text-[32px] font-semibold leading-tight text-[#dde2f4] md:text-[40px]">
                Chào mừng trở lại, <span className="text-[#ffc080]">{user?.full_name ?? 'bạn'}</span>.
              </h1>
              <p className="mt-3 max-w-xl text-[16px] leading-7 text-[#c1c6d7]">
                Tiếp tục học, quản lý nội dung và theo dõi các hoạt động mới nhất trong LearnSphere.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a className="rounded-lg bg-[#adc7ff] px-5 py-3 font-mono text-[13px] font-bold text-[#002e68] transition hover:brightness-110 active:scale-95" href="/courses">
                  Mở khóa học
                </a>
                <a className="rounded-lg border border-[#414754] px-5 py-3 font-mono text-[13px] font-bold text-[#c1c6d7] transition hover:border-[#adc7ff]/60 hover:text-[#adc7ff]" href="/profile">
                  Hồ sơ của tôi
                </a>
              </div>
            </div>
            <span className="material-symbols-outlined absolute bottom-[-32px] right-0 text-[180px] text-[#adc7ff]/10" style={{ fontVariationSettings: '"wght" 200' }}>
              psychology
            </span>
          </section>

          <section className="col-span-12 grid grid-cols-2 gap-3 lg:col-span-4">
            {[
              { label: 'Đang học', value: user?.role === 'student' ? activeCourses : roleActions.length, icon: 'trending_up', tone: 'text-[#24dfba]' },
              { label: 'Chờ duyệt', value: user?.role === 'student' ? pendingCourses : 0, icon: 'schedule', tone: 'text-[#ffc080]' },
              { label: 'Tác vụ nhanh', value: roleActions.length, icon: 'bolt', tone: 'text-[#adc7ff]' },
            ].map((item, index) => (
              <article key={item.label} className={`surface-card rounded-xl p-4 ${index === 2 ? 'col-span-2' : ''}`}>
                <span className="font-mono text-[12px] text-[#8b90a0]">{item.label}</span>
                <div className="mt-4 flex items-end justify-between">
                  <strong className="text-[28px] leading-none text-[#dde2f4]">{item.value}</strong>
                  <span className={`material-symbols-outlined ${item.tone}`}>{item.icon}</span>
                </div>
              </article>
            ))}
          </section>

          <section className="glass-card col-span-12 rounded-xl p-6 lg:col-span-7">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[24px] font-semibold">Tác vụ theo vai trò</h2>
                <p className="mt-1 text-[14px] text-[#8b90a0]">Các luồng công việc bạn hay dùng nhất.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {roleActions.map((action) => (
                <a key={`${action.href}-${action.label}`} className="group rounded-lg border border-white/5 bg-[#080e1a] p-4 transition hover:border-[#adc7ff]/40 hover:bg-[#242a37]" href={action.href}>
                  <span className="material-symbols-outlined mb-4 text-[30px] text-[#adc7ff] transition group-hover:text-[#ffc080]">{action.icon}</span>
                  <h3 className="text-[17px] font-semibold">{action.label}</h3>
                </a>
              ))}
            </div>
          </section>

          <section className="glass-card col-span-12 rounded-xl p-6 lg:col-span-5">
            <h2 className="mb-5 text-[24px] font-semibold">Gợi ý từ Sphere AI</h2>
            <div className="space-y-3">
              {[
                { icon: 'auto_awesome', title: 'Cá nhân hóa lộ trình', text: 'Dùng kết quả quiz để ưu tiên bài học tiếp theo.' },
                { icon: 'rocket_launch', title: 'Tăng tốc tiến độ', text: 'Tập trung vào khóa đang active trước khi mở thêm khóa mới.' },
              ].map((item) => (
                <article key={item.title} className="flex gap-3 rounded-lg bg-[#2f3542]/40 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#adc7ff]/15 text-[#adc7ff]">
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </span>
                  <div>
                    <h3 className="text-[14px] font-bold">{item.title}</h3>
                    <p className="mt-1 text-[13px] leading-5 text-[#c1c6d7]">{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {user?.role === 'student' && (
            <section className="glass-card col-span-12 rounded-xl p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-[28px] font-semibold">Khóa học của tôi</h2>
                  <p className="mt-1 text-[14px] text-[#8b90a0]">Theo dõi ảnh khóa học, tiến trình và trạng thái đăng ký.</p>
                </div>
                <a className="font-mono text-[13px] font-bold text-[#adc7ff] hover:underline" href="/my-courses">
                  Xem tất cả
                </a>
              </div>

              {isLoadingCourses && <p className="font-mono text-[12px] text-[#8b90a0]">Đang tải khóa học...</p>}
              {!isLoadingCourses && !myCourses.length && (
                <div className="rounded-lg border border-dashed border-[#414754] bg-[#080e1a] p-8 text-center text-[#c1c6d7]">
                  Chưa có khóa học đăng ký nào.
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {myCourses.map((course) => {
                  const progress = course.progress;
                  const progressPercent = course.status === 'active' ? progress?.progress_percent ?? 0 : 0;
                  const canOpenCourse = course.status === 'active';
                  const href = `/course-detail?course_id=${encodeURIComponent(course.id)}`;

                  return (
                    <article key={course.id} className="group overflow-hidden rounded-2xl border border-[#253047] bg-[#070d19] shadow-2xl shadow-black/20 transition hover:border-[#adc7ff]/40">
                      <a
                        className="block"
                        href={canOpenCourse ? href : '#'}
                        onClick={(event) => {
                          if (!canOpenCourse) event.preventDefault();
                        }}
                      >
                        <div className="relative aspect-[16/7] overflow-hidden bg-[#101827]">
                          <div
                            className="h-full w-full bg-cover bg-center transition duration-500 group-hover:scale-105"
                            style={{ backgroundImage: `url(${course.thumbnailUrl || fallbackCourseImage})` }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#070d19] via-[#070d19]/20 to-transparent" />
                          <span className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[12px] font-bold ${course.status === 'active' ? 'bg-[#24dfba]/15 text-[#24dfba]' : 'bg-[#ffc080]/15 text-[#ffc080]'}`}>
                            <span className="material-symbols-outlined text-[16px]">{course.status === 'active' ? 'play_circle' : 'schedule'}</span>
                            {course.status === 'active' ? 'Đang học' : 'Chờ duyệt'}
                          </span>
                        </div>
                      </a>

                      <div className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-[22px] font-semibold leading-7 text-[#dde2f4]">{course.title}</h3>
                            <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-[#c1c6d7]">{course.description}</p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#111827] px-3 py-2 font-mono text-[11px] text-[#adc7ff]">
                            <span className="material-symbols-outlined text-[15px]">groups</span>
                            {course.enrollmentCount} học viên
                          </span>
                        </div>

                        <div className="mt-5 rounded-xl border border-[#253047] bg-[#111827]/80 p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="font-mono text-[12px] uppercase tracking-wide text-[#8f9bb3]">Tiến trình học tập</span>
                            <strong className="font-mono text-[13px] text-[#24dfba]">{progressPercent}%</strong>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#263145]">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#24dfba] to-[#adc7ff] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                          </div>
                          <p className="mt-2 font-mono text-[12px] text-[#8f9bb3]">
                            {course.status === 'active'
                              ? progress
                                ? `Đã hoàn thành ${progress.completed_lessons}/${progress.total_lessons} bài học`
                                : 'Đang cập nhật tiến độ học tập...'
                              : `Đã gửi đăng ký ngày ${formatCourseDate(course.requestedAt)}`}
                          </p>
                        </div>

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 font-mono text-[12px] text-[#8b90a0]">
                            <p className="truncate">Người tạo: {course.author}</p>
                            <p className="mt-1">Ngày duyệt: {formatCourseDate(course.approvedAt)}</p>
                          </div>
                          <a
                            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 font-mono text-[12px] font-black uppercase tracking-wide transition ${
                              canOpenCourse
                                ? 'bg-[#adc7ff] text-[#00285b] hover:brightness-110'
                                : 'pointer-events-none border border-[#ffc080]/30 bg-[#ffc080]/10 text-[#ffc080]'
                            }`}
                            href={canOpenCourse ? href : '#'}
                          >
                            <span className="material-symbols-outlined text-[18px]">{canOpenCourse ? 'play_arrow' : 'hourglass_top'}</span>
                            {canOpenCourse ? 'Vào học' : 'Chờ duyệt'}
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      <SphereAIButton />
    </div>
  );
}
