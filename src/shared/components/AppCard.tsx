import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

export function AppCard({
  title,
  description,
  to,
  icon: Icon,
}: {
  title: string;
  description: string;
  to: string;
  icon: ComponentType<{ className?: string; size?: number }>;
}) {
  return (
    <Link
      to={to}
      className="group section-card flex h-full flex-col p-6 transition duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_28px_60px_-30px_rgba(236,91,19,0.35)]"
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 transition duration-200 group-hover:bg-orange-600 group-hover:text-white">
        <Icon size={24} />
      </div>
      <div className="flex flex-1 flex-col">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{description}</p>
        <span className="mt-6 text-sm font-bold text-orange-700">바로 가기</span>
      </div>
    </Link>
  );
}
