import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { AppToast } from '../components/AppToast';
import { RoleSidebar } from '../components/RoleSidebar';
import { canManageContent, getRoleLabel, getRoleNav } from '../lib/roleAccess';
import { api, getStoredUser, type Course } from '../services/api';

const avatarSrc =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAK3DeXFfcU7eoLcYm0J-P0geFc_1SNB3sOpbZdSgXNGYGNkWLvpydHgoO3teNd6SCKCfYzJzNrs1AB7P8Pu74X-3istluRsHM1oPvbEs2nLPM2cHWOxHmwakxXKAZY99rZGG-p9kypULkAvH9bkTxwS1EgNluYqYhNlGpql2gZkqIWaOYk5FWOQvYjhFI2VJivahYgEOwamgFB5MZtSI9a-fovv-ztHAlZ1TjPwNnEgpB773mBUptA6A';

function formatDate(value?: string | null) {
  if (!value) return 'Chưa rõ';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function LockedCoursesPage() {
  const user = getStoredUser();
  const navItems = useMemo(() => getRoleNav(user), [user]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadDeletedCourses() {
    if (!canManageContent(user)) return;

    setIsLoading(true);
    setMessage('');
    try {
      setCourses(await api.getDeletedCourses());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể tải khóa học bị khóa');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDeletedCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?._id, user?.role]);

  async function handleRestore(courseId: string) {
    const confirmed = window.confirm('Mở khóa khóa học này và đưa trở lại danh sách chính?');
    if (!confirmed) return;

    try {
      const result = await api.restoreCourse(courseId);
      setMessage(result.message);
      await loadDeletedCourses();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể mở khóa khóa học');
    }
  }

  if (!canManageContent(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d131f] px-4 text-[#dde2f4]">
        <section className="max-w-md rounded-xl border border-[#414754] bg-[#161c28] p-8 text-center">
          <span className="material-symbols-outlined mb-4 text-[48px] text-[#ffb4ab]">lock</span>
          <h1 className="text-[26px] font-semibold">Không có quyền truy cập</h1>
          <p className="mt-2 text-[#c1c6d7]">Chỉ giảng viên và admin được xem khóa học bị khóa.</p>
          <a className="mt-6 inline-flex rounded-lg bg-[#adc7ff] px-5 py-3 font-bold text-[#002e68]" href="/dashboard">
            Về bảng điều khiển
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d131f] text-[#dde2f4]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <RoleSidebar activePath="/locked-courses" items={navItems} user={user} />
      <AppToast message={message} tone="warning" onClose={() => setMessage('')} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:pl-72 md:pr-8">
        <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 font-mono text-[12px] uppercase tracking-wider text-[#8b90a0]">{getRoleLabel(user?.role)}</p>
            <h1 className="text-[32px] font-semibold">Khóa học bị khóa</h1>
            <p className="mt-1 text-[#c1c6d7]">
              Đây là danh sách khóa học đang ở trạng thái xóa mềm. Admin có thể mở khóa; giảng viên thấy các khóa của mình để theo dõi trạng thái.
            </p>
          </div>
          <span className="rounded-lg border border-white/5 bg-[#161c28] px-4 py-2 font-mono text-[12px] text-[#8b90a0]">
            {courses.length} khóa học
          </span>
        </section>

        {isLoading && (
          <div className="rounded-lg border border-[#ffc080]/30 bg-[#ffc080]/10 px-4 py-3 text-[14px] text-[#ffc080]">
            Đang tải dữ liệu...
          </div>
        )}

        {!isLoading && !courses.length ? (
          <section className="rounded-xl border border-dashed border-[#414754] bg-[#161c28] p-10 text-center">
            <span className="material-symbols-outlined mb-3 text-[44px] text-[#8b90a0]">lock_open</span>
            <h2 className="text-[22px] font-semibold">Không có khóa học bị khóa</h2>
            <p className="mt-2 text-[#c1c6d7]">Khi có khóa học bị tạm khóa hoặc xóa mềm, khóa học sẽ xuất hiện ở đây.</p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {courses.map((course) => {
              const creator = typeof course.created_by === 'object' ? course.created_by.full_name : 'Chưa rõ';
              return (
                <article key={course._id} className="rounded-xl border border-white/5 bg-[#161c28] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-[22px] font-semibold">{course.title}</h2>
                      <p className="mt-2 line-clamp-2 text-[#c1c6d7]">{course.description || 'Chưa có mô tả'}</p>
                    </div>
                    <span className="rounded-full border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-3 py-1 font-mono text-[12px] text-[#ffb4ab]">
                      Đang khóa
                    </span>
                  </div>
                  <div className="mt-5 grid gap-2 font-mono text-[12px] text-[#8b90a0] sm:grid-cols-2">
                    <p>Người sở hữu: {creator}</p>
                    <p>Ngày khóa: {formatDate(course.deleted_at)}</p>
                    <p>Trạng thái API: xóa mềm</p>
                  </div>
                  {user?.role === 'admin' && (
                    <button className="mt-5 rounded-lg bg-[#24dfba] px-5 py-3 font-mono text-[13px] font-bold text-[#00382c]" type="button" onClick={() => void handleRestore(course._id)}>
                      Mở khóa
                    </button>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
