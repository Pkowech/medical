import React from 'react';
import Link from 'next/link';

const Breadcrumb: React.FC<{ items?: { label: string; href?: string }[] }> = ({ items = [] }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="breadcrumb" className="mb-2 max-w-full overflow-hidden text-xs text-muted-foreground sm:text-sm">
      <ol className="flex min-w-0 items-center gap-1 whitespace-nowrap sm:gap-2">
        {items.map((item, idx) => (
          <li
            key={idx}
            className={`${idx < items.length - 2 ? 'hidden sm:flex' : 'flex'} min-w-0 shrink items-center sm:shrink-0`}
          >
            {item.href ? (
              <Link href={item.href} className="max-w-[42vw] truncate hover:underline sm:max-w-56" title={item.label}>
                {item.label}
              </Link>
            ) : (
              <span className="max-w-[42vw] truncate sm:max-w-56" title={item.label}>{item.label}</span>
            )}
            {idx < items.length - 1 && <span aria-hidden="true" className="mx-1.5 sm:mx-2">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
};

// Named export to match existing imports
export { Breadcrumb };
export default Breadcrumb;
