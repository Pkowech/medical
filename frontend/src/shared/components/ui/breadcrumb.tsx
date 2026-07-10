import React from 'react';
import Link from 'next/link';

const Breadcrumb: React.FC<{ items?: { label: string; href?: string }[] }> = ({ items = [] }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="breadcrumb" className="mb-4 text-sm text-gray-600">
      <ol className="flex items-center gap-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center">
            {item.href ? (
              <Link href={item.href} className="hover:underline">
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
            {idx < items.length - 1 && <span className="mx-2">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
};

// Named export to match existing imports
export { Breadcrumb };
export default Breadcrumb;
