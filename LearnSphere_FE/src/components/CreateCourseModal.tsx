import { useState, type FormEvent } from 'react';
import { api, type EnrollmentType } from '../services/api';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (courseId: string) => Promise<void> | void;
  onMessage: (message: string) => void;
};

const emptyForm = { title: '', description: '', enrollment_type: 'open' as EnrollmentType };
const fieldClass = 'w-full rounded-xl border border-[#354055] bg-[#070d19] px-4 py-3 text-[#e7ecff] outline-none placeholder:text-[#7f8aa3] focus:border-[#adc7ff] focus:ring-2 focus:ring-[#adc7ff]/20';

export function CreateCourseModal({ isOpen, onClose, onCreated, onMessage }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  function close() {
    if (isCreating) return;
    setForm(emptyForm);
    setThumbnailFile(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      onMessage('Vui lòng nhập tên khóa học.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await api.createCourse({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        enrollment_type: form.enrollment_type,
      });
      const courseId = result.course?._id;
      let successMessage = 'Tạo khóa học thành công!';

      if (thumbnailFile && courseId) {
        try {
          const presigned = await api.createPresignedUpload({
            course_id: courseId,
            file_name: thumbnailFile.name,
            content_type: thumbnailFile.type || 'image/jpeg',
            file_size: thumbnailFile.size,
            folder: 'thumbnails',
          });
          await api.uploadFileToS3(presigned.upload_url, thumbnailFile);
          await api.updateCourse(courseId, { thumbnail_key: presigned.file_key });
        } catch {
          successMessage = 'Tạo khóa học thành công nhưng không thể tải thumbnail.';
        }
      }

      setForm(emptyForm);
      setThumbnailFile(null);
      onClose();
      if (courseId) await onCreated(courseId);
      onMessage(successMessage);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Không thể tạo khóa học.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6">
      <form className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-2xl border border-[#354055] bg-[#111827] shadow-2xl shadow-black/50" onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-4 border-b border-[#253047] px-5 py-4 sm:px-6">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#adc7ff]/25 bg-[#adc7ff]/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#adc7ff]">
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Khóa học mới
            </span>
            <h2 className="mt-3 text-[25px] font-extrabold text-white">Tạo khóa học</h2>
            <p className="mt-1 text-[14px] text-[#8f9bb3]">Nhập thông tin cơ bản; bạn có thể thêm bài học sau khi tạo xong.</p>
          </div>
          <button className="rounded-xl border border-[#354055] p-2 text-[#b8c1d6] transition hover:bg-[#1a2435] disabled:opacity-50" type="button" disabled={isCreating} onClick={close} aria-label="Đóng form tạo khóa học">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[12px] uppercase tracking-wider text-[#9da8bd]">Tên khóa học</span>
            <input className={fieldClass} autoFocus maxLength={200} placeholder="Ví dụ: Hóa học 12" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-mono text-[12px] uppercase tracking-wider text-[#9da8bd]">Mô tả khóa học</span>
            <textarea className={`${fieldClass} min-h-32 resize-y leading-6`} maxLength={1000} placeholder="Mô tả mục tiêu và nội dung chính của khóa học..." value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            <span className="text-right font-mono text-[11px] text-[#657188]">{form.description.length}/1000</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[12px] uppercase tracking-wider text-[#9da8bd]">Hình thức đăng ký</span>
              <select className={fieldClass} value={form.enrollment_type} onChange={(event) => setForm((current) => ({ ...current, enrollment_type: event.target.value as EnrollmentType }))}>
                <option value="open">Đăng ký mở</option>
                <option value="approval_required">Cần giảng viên duyệt</option>
              </select>
            </label>

            <label className="flex cursor-pointer flex-col gap-2">
              <span className="font-mono text-[12px] uppercase tracking-wider text-[#9da8bd]">Thumbnail</span>
              <span className="flex min-h-[50px] items-center gap-2 rounded-xl border border-dashed border-[#46536b] bg-[#070d19] px-4 py-3 text-[13px] text-[#adc7ff] transition hover:border-[#adc7ff]">
                <span className="material-symbols-outlined text-[20px]">upload</span>
                <span className="min-w-0 truncate">{thumbnailFile ? thumbnailFile.name : 'Chọn ảnh JPG, PNG hoặc WebP'}</span>
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)} />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-[#253047] pt-5 sm:flex-row sm:justify-end">
            <button className="rounded-xl border border-[#46536b] px-5 py-3 font-mono text-[12px] font-black uppercase tracking-wide text-[#c5cee3] transition hover:bg-[#1a2435] disabled:opacity-50" type="button" disabled={isCreating} onClick={close}>Hủy</button>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#adc7ff] px-5 py-3 font-mono text-[12px] font-black uppercase tracking-wide text-[#00285b] transition hover:brightness-110 disabled:opacity-60" type="submit" disabled={isCreating}>
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              {isCreating ? 'Đang tạo...' : 'Tạo khóa học'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
