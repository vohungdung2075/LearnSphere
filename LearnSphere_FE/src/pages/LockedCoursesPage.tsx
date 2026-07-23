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
  const [courseToRestore, setCourseToRestore] = useState<Course | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [courseToPurge, setCourseToPurge] = useState<Course | null>(null);
  const [isPurging, setIsPurging] = useState(false);

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

  async function handleRestore() {
    if (!courseToRestore) return;
    setIsRestoring(true);
    try {
      const result = await api.restoreCourse(courseToRestore._id);
      setMessage(result.message);
      setCourseToRestore(null);
      await loadDeletedCourses();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể khôi phục khóa học');
    } finally {
      setIsRestoring(false);
    }
  }

  async function handlePermanentDelete() {
    if (!courseToPurge) return;
    setIsPurging(true);
    try {
      const result = await api.permanentlyDeleteCourse(courseToPurge._id);
      setMessage(`${result.message} (${result.deleted_s3_objects} file S3)`);
      setCourseToPurge(null);
      await loadDeletedCourses();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể xóa vĩnh viễn khóa học');
    } finally {
      setIsPurging(false);
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
    <div className="min-h-screen bg-[#070d19] text-[#e7ecff]">
      <AppHeader user={user} roleLabel={getRoleLabel(user?.role)} avatarSrc={avatarSrc} />
      <RoleSidebar activePath="/locked-courses" items={navItems} user={user} />
      <AppToast message={message} tone="warning" onClose={() => setMessage('')} />

      {courseToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <section className="w-full max-w-[520px] rounded-2xl border border-[#354055] bg-[#111827] p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#24dfba]/30 bg-[#24dfba]/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#24dfba]">
                  <span className="material-symbols-outlined text-[16px]">lock_open</span>
                  Khôi phục
                </span>
                <h2 className="mt-4 text-[24px] font-extrabold text-white">Khôi phục khóa học này?</h2>
                <p className="mt-2 text-[14px] leading-6 text-[#b8c1d6]">{courseToRestore.title}</p>
              </div>
              <button
                className="rounded-lg border border-[#354055] p-2 text-[#b8c1d6] transition hover:bg-[#1a2435]"
                type="button"
                onClick={() => {
                  if (!isRestoring) setCourseToRestore(null);
                }}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-[#354055] bg-[#070d19] p-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Lý do khóa hiện tại</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-6 text-[#e7ecff]">
                {courseToRestore.deleted_reason || 'Chưa có lý do khóa.'}
              </p>
            </div>

            <p className="mt-4 text-[14px] leading-6 text-[#b8c1d6]">
              Sau khi khôi phục, khóa học sẽ quay lại danh sách khóa học chính và người học có thể truy cập lại nội dung.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-[#354055] px-5 py-3 font-mono text-[12px] font-bold text-[#b8c1d6] transition hover:bg-[#1a2435]"
                type="button"
                disabled={isRestoring}
                onClick={() => setCourseToRestore(null)}
              >
                Hủy
              </button>
              <button
                className="rounded-xl bg-[#24dfba] px-5 py-3 font-mono text-[12px] font-black uppercase tracking-wide text-[#00382c] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isRestoring}
                onClick={() => void handleRestore()}
              >
                {isRestoring ? 'Đang khôi phục...' : 'Khôi phục'}
              </button>
            </div>
          </section>
        </div>
      )}

      {courseToPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6">
          <section className="w-full max-w-[540px] rounded-2xl border border-[#ffb4ab]/30 bg-[#111827] p-5 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#ffb4ab]">
                  <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  Không thể hoàn tác
                </span>
                <h2 className="mt-4 text-[24px] font-extrabold text-white">Xóa vĩnh viễn khóa học?</h2>
                <p className="mt-2 text-[14px] leading-6 text-[#b8c1d6]">{courseToPurge.title}</p>
              </div>
              <button
                className="rounded-lg border border-[#354055] p-2 text-[#b8c1d6] transition hover:bg-[#1a2435]"
                type="button"
                aria-label="Đóng"
                onClick={() => {
                  if (!isPurging) setCourseToPurge(null);
                }}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-[#ffb4ab]/25 bg-[#ffb4ab]/10 p-4 text-[14px] leading-6 text-[#ffd9d5]">
              Toàn bộ video, tài liệu, thumbnail trên S3 cùng bài học, quiz, tiến độ, lượt ghi danh và dữ liệu liên quan sẽ bị xóa. Khóa học không thể khôi phục sau thao tác này.
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-[#354055] px-5 py-3 font-mono text-[12px] font-bold text-[#b8c1d6] transition hover:bg-[#1a2435]"
                type="button"
                disabled={isPurging}
                onClick={() => setCourseToPurge(null)}
              >
                Hủy
              </button>
              <button
                className="rounded-xl bg-[#ffb4ab] px-5 py-3 font-mono text-[12px] font-black uppercase tracking-wide text-[#690005] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isPurging}
                onClick={() => void handlePermanentDelete()}
              >
                {isPurging ? 'Đang xóa dữ liệu...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </section>
        </div>
      )}

      <main className="mx-auto max-w-[1180px] space-y-5 px-4 py-6 md:pl-64 md:pr-6">
        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20 md:flex-row md:items-end">
          <div>
            <p className="mb-2 font-mono text-[12px] uppercase tracking-wider text-[#8b90a0]">{getRoleLabel(user?.role)}</p>
            <h1 className="text-[32px] font-semibold">Khóa học bị khóa</h1>
            <p className="mt-1 text-[#c1c6d7]">
              Danh sách khóa học đã xóa mềm. Admin và giảng viên sở hữu khóa học có thể khôi phục hoặc xóa vĩnh viễn cả dữ liệu S3.
            </p>
          </div>
          <span className="rounded-xl border border-[#354055] bg-[#070d19] px-4 py-2 font-mono text-[12px] text-[#8b90a0]">
            {courses.length} khóa học
          </span>
        </section>

        {isLoading && (
          <div className="rounded-lg border border-[#ffc080]/30 bg-[#ffc080]/10 px-4 py-3 text-[14px] text-[#ffc080]">
            Đang tải dữ liệu...
          </div>
        )}

        {!isLoading && !courses.length ? (
          <section className="rounded-2xl border border-dashed border-[#354055] bg-[#111827]/92 p-10 text-center shadow-xl shadow-black/20">
            <span className="material-symbols-outlined mb-3 text-[44px] text-[#8b90a0]">lock_open</span>
            <h2 className="text-[22px] font-semibold">Không có khóa học bị khóa</h2>
            <p className="mt-2 text-[#c1c6d7]">Khi có khóa học bị tạm khóa hoặc xóa mềm, khóa học sẽ xuất hiện ở đây.</p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {courses.map((course) => {
              const creator = typeof course.created_by === 'object' ? course.created_by.full_name : 'Chưa rõ';
              return (
                <article key={course._id} className="rounded-2xl border border-[#253047] bg-[#111827]/92 p-5 shadow-xl shadow-black/20">
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
                  <div className="mt-4 rounded-xl border border-[#354055] bg-[#070d19] p-3">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-[#8b90a0]">Lý do khóa</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-6 text-[#e7ecff]">
                      {course.deleted_reason || 'Chưa có lý do khóa.'}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button className="rounded-lg bg-[#24dfba] px-5 py-3 font-mono text-[13px] font-bold text-[#00382c]" type="button" onClick={() => setCourseToRestore(course)}>
                      Khôi phục
                    </button>
                    <button
                      className="rounded-lg border border-[#ffb4ab]/50 bg-[#ffb4ab]/10 px-5 py-3 font-mono text-[13px] font-bold text-[#ffb4ab] transition hover:bg-[#ffb4ab]/20"
                      type="button"
                      onClick={() => setCourseToPurge(course)}
                    >
                      Xóa vĩnh viễn
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
