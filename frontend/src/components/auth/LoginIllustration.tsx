import gellyObject from '@/assets/gelly-object.png';

const LoginIllustration = () => (
  <section className="relative hidden lg:flex lg:flex-1 lg:flex-col lg:pt-[340px]">
    <div className="relative h-[683px] w-full">
      <img
        src={gellyObject}
        alt="GellyBank login illustration"
        className="absolute left-16 top-[110px] h-[513px] w-[497px] max-w-none"
      />
    </div>

    <span className="pointer-events-none absolute right-[-89px] top-[-95px] h-[390px] w-[427px] rounded-full bg-white/10" />
  </section>
);

export default LoginIllustration;
