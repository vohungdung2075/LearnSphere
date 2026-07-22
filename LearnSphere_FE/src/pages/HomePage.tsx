import { SphereAIButton } from '../components/SphereAIButton';

export function HomePage() {
  return (
    <div className="min-h-screen bg-[#0d131f] text-[#dde2f4]">
      <nav className="fixed left-0 right-0 top-0 z-50 h-20 bg-[#0d131f]/90 shadow-sm transition-all duration-300 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#adc7ff]">LearnSphere</span>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            <a className="border-b-2 border-[#adc7ff] pb-1 text-sm font-bold text-[#adc7ff]" href="#courses">
              Khóa học
            </a>
            <a className="text-sm font-medium text-[#c1c6d7] transition-colors hover:text-[#adc7ff]" href="#grading">
              Chấm điểm
            </a>
            <a className="text-sm font-medium text-[#c1c6d7] transition-colors hover:text-[#adc7ff]" href="#resources">
              Tài nguyên
            </a>
          </div>

          <div className="flex items-center gap-3">
            <a className="text-sm font-medium text-[#c1c6d7] transition-colors hover:text-[#adc7ff]" href="/login">
              Đăng nhập
            </a>
            <a className="rounded-lg bg-[#adc7ff] px-6 py-2.5 text-sm font-bold text-[#00285b] transition-transform active:scale-95" href="/signup">
              Đăng ký
            </a>
          </div>
        </div>
      </nav>

      <main className="relative pt-20">
        <section className="hero-gradient relative flex min-h-[921px] items-center justify-center overflow-hidden px-4 py-12 md:px-8 lg:px-10">
          <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div className="space-y-8 text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#24dfba]/20 bg-[#24dfba]/10 px-3 py-1 text-[#24dfba]">
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                <span className="text-[12px] font-medium leading-4 tracking-normal font-mono">Vận hành bởi hạ tầng AWS</span>
              </div>

              <h1 className="max-w-xl text-[48px] font-bold leading-[1.1] tracking-[-0.02em] text-[#dde2f4] md:text-[56px]">
                Làm chủ Tương lai với Học tập <span className="text-[#adc7ff]">Hỗ trợ bởi AI</span> trên LearnSphere [AWS Cloud]
              </h1>

              <p className="max-w-xl text-[18px] leading-7 text-[#c1c6d7]">
                Trải nghiệm kỷ nguyên học tập thông minh với Aura AI: linh hoạt, bảo mật và tích hợp sâu với nền tảng cloud toàn diện.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <a className="inline-flex items-center justify-center rounded-xl bg-[#adc7ff] px-8 py-4 text-[16px] font-bold text-[#00285b] shadow-lg shadow-[#adc7ff]/20 transition-all active:scale-95" href="/login">
                  Bắt đầu miễn phí
                </a>
                <a className="inline-flex items-center justify-center rounded-xl border-2 border-[#414754] bg-[#1a202c] px-8 py-4 text-[16px] font-semibold text-[#dde2f4] transition-all hover:bg-[#242a37]" href="#courses">
                  Xem lộ trình học
                </a>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-[#adc7ff]/20 to-[#24dfba]/20 opacity-30 blur-3xl" />
              <div className="glass-card ai-glow relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-[#161f2e]/70">
                <img
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAe8DxmShjwPAYYUKrGIots3jg6UcZnAw-Ula3KRv2mbaHARKmn16UOyi7NbNze7yO2X7p3sL2oxPbt9qQm3H6yLLrvDhVm5TuuNM6rZf7pPFzsGNK6Z2maTnJefmqYWsZLinpV9f2R-9EjR3BwrFYdG26Z2ch_zL5TD7voP4QTgJH2mGz-YRcvgGLxn4agDZc49FvzzevNJgwRq40WJTAbEWazRiIxvFinjhrA1q2wSee7XTwHCrAqBw"
                  alt="Hero visual"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d131f] via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 flex items-center gap-4 rounded-xl border border-white/10 bg-[#161f2e]/70 p-4 backdrop-blur">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#adc7ff]/20 text-[#adc7ff]">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: '"FILL" 1' }}>
                      psychology
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-[#adc7ff] font-mono">Aura AI đang hoạt động</p>
                    <p className="text-[12px] text-[#c1c6d7] font-mono">Đang phân tích thói quen học...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="courses" className="border-y border-[#414754]/20 bg-[#161c28] py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-10">
            <div className="mb-12 text-center">
              <h2 className="text-[32px] font-semibold leading-10 tracking-[-0.01em] text-[#dde2f4]">Hệ sinh thái thông minh</h2>
              <p className="mx-auto mt-2 max-w-2xl text-[16px] leading-6 text-[#c1c6d7]">
                Mọi công cụ bạn cần để học tập hiệu quả trong thế giới cloud-first và AI-driven.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                {
                  title: 'Quản lý khóa học',
                  text: 'Sắp xếp khóa học gọn gàng cho học viên và giảng viên, theo dõi lộ trình và tài nguyên tập trung.',
                  accent: 'border-l-[#adc7ff]'
                },
                {
                  title: 'Hỗ trợ AI',
                  text: 'Gia sư cá nhân 24/7 với Aura AI, trả lời tức thì, gợi ý kế hoạch học và hỗ trợ coding tương tác.',
                  accent: 'border-l-[#24dfba]'
                },
                {
                  title: 'Chấm điểm tự động',
                  text: 'Phản hồi thông minh tức thì nhờ hạ tầng cloud, giúp mở rộng quy trình đánh giá mà không tốn thao tác thủ công.',
                  accent: 'border-l-[#ffb86f]'
                },
              ].map((item, index) => (
                <article
                  key={item.title}
                  className={`glass-card relative rounded-xl border-l-4 ${item.accent} p-6 transition-all duration-300 hover:-translate-y-1`}
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 text-[#adc7ff]">
                    <span className="material-symbols-outlined">{index === 0 ? 'auto_stories' : index === 1 ? 'smart_toy' : 'verified'}</span>
                  </div>
                  <h3 className="mb-2 text-[24px] font-semibold leading-8 text-[#dde2f4]">{item.title}</h3>
                  <p className="text-[16px] leading-6 text-[#c1c6d7]">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="assistant" className="border-b border-[#414754]/20 bg-[#0d131f] py-12 md:py-16">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 md:px-8 lg:grid-cols-2 lg:px-10">
            <div className="rounded-2xl border border-white/10 bg-[#161f2e]/70 p-4 shadow-2xl">
              <img
                className="w-full rounded-[18px] object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuANY8tJqvaOGxsMAN9XklQDNALz8YomuZH213zwIKqtQIZ8Wcq6wdFC_JqbfbjKJvMJJWwJQKkdYI_hs2ecUCmmqv-BGe3Y-JsqlBAJMQugf0Em8-5wAntjyi5JXGWXIYohm_DRLNrGBhpGJpRQvylg2RCMuxFCPpfpSGHOMLM2VuuNmSj5NPkHVCJ_75SEsoZqOSk_zWQnyTeWBlvhzky7ycpWwc9xvLe35woANu_zne1ykL2okeIjZA"
                alt="Server room"
              />
            </div>

            <div className="space-y-6">
              <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-[#ffb86f]">Quy mô toàn cầu</p>
              <h2 className="text-[32px] font-semibold leading-10 tracking-[-0.01em] text-[#dde2f4]">Cloud là lớp học của bạn</h2>
              <p className="text-[16px] leading-7 text-[#c1c6d7]">
                Tận dụng Amazon Bedrock và SageMaker, Aura AI hỗ trợ phản hồi nhanh cho học tập thời gian thực. Nền tảng thích nghi với nhịp học của bạn và cung cấp phân tích sâu cho giảng viên.
              </p>
              <ul className="space-y-4">
                {[
                  '99.99% thời gian hoạt động của hạ tầng',
                  'Chuẩn bảo mật cấp doanh nghiệp',
                  'Phân phối nội dung học tập trên edge toàn cầu',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-[#c1c6d7]">
                    <span className="material-symbols-outlined text-[#24dfba]">check_circle</span>
                    <span className="text-[16px] leading-6">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="grading" className="px-4 py-14 text-center md:px-8 lg:px-10 lg:py-16">
          <div className="mx-auto max-w-3xl space-y-6">
            <h2 className="text-[48px] font-bold leading-tight tracking-[-0.02em] text-[#dde2f4]">
              Sẵn sàng phát triển kỹ năng?
            </h2>
            <p className="text-[18px] leading-7 text-[#c1c6d7]">
              Tham gia cùng hàng nghìn chuyên gia đang làm chủ AI trên nền tảng cloud có khả năng mở rộng cao.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row">
              <button className="rounded-xl bg-[#adc7ff] px-10 py-4 text-[16px] font-bold text-[#00285b] transition-all active:scale-95">
                Đăng ký ngay
              </button>
              <button className="rounded-xl border border-[#414754] bg-[#242a37] px-10 py-4 text-[16px] font-semibold text-[#dde2f4] transition-all hover:bg-[#333947]">
                Khám phá khóa học
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer id="resources" className="border-t border-[#414754] bg-[#0d131f] px-4 py-10 md:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row md:items-end">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <span className="text-[24px] font-bold text-[#dde2f4]">LearnSphere</span>
            <p className="max-w-xs text-center text-[12px] leading-5 text-[#c1c6d7] md:text-left">
              © 2024 Nền tảng LearnSphere. Vận hành bởi AWS Cloud.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-[12px] text-[#c1c6d7] md:justify-start">
            <a href="#">Về chúng tôi</a>
            <a href="#">Chính sách bảo mật</a>
            <a href="#">Điều khoản dịch vụ</a>
            <a href="#">AWS Infrastructure</a>
            <a href="#">Liên hệ hỗ trợ</a>
          </div>

          <div className="flex items-center gap-3 text-[#c1c6d7]">
            <a href="#">Đăng nhập</a>
            <span className="text-[#414754]">|</span>
            <span className="material-symbols-outlined text-[20px]">language</span>
            <span className="material-symbols-outlined text-[20px]">hub</span>
          </div>
        </div>
      </footer>

      <SphereAIButton />
    </div>
  );
}
