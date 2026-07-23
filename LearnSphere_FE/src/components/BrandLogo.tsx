import logoSrc from '../assets/learnsphere-logo.svg';

type BrandLogoProps = {
  href?: string;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
};

export function BrandLogo({
  href = '/',
  className = '',
  iconClassName = 'text-[30px]',
  textClassName = 'text-[24px]',
}: BrandLogoProps) {
  return (
    <a className={`inline-flex items-center gap-2 text-[#adc7ff] ${className}`} href={href}>
      <img className={`h-[1em] w-[1em] shrink-0 object-contain ${iconClassName}`} src={logoSrc} alt="" aria-hidden="true" />
      <span className={`font-bold leading-none ${textClassName}`}>LearnSphere</span>
    </a>
  );
}
