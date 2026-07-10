'use client';

import React from 'react';
import Link from 'next/link';
import { FaBookMedical, FaHeartbeat, FaBrain, FaVials } from 'react-icons/fa';

interface QuickLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

const QuickLink: React.FC<QuickLinkProps> = ({ href, icon, title, subtitle }) => (
  <Link
    href={href}
    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
  >
    <div className="flex-shrink-0">{icon}</div>
    <div>
      <h3 className="font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
  </Link>
);

export default function QuickAccess() {
  const quickLinks = [
    {
      href: '/subjects/anatomy',
      icon: <FaHeartbeat className="h-5 w-5 text-red-500" />,
      title: 'Anatomy',
      subtitle: 'Resume cardiovascular system',
    },
    {
      href: '/subjects/physiology',
      icon: <FaBrain className="h-5 w-5 text-blue-500" />,
      title: 'Physiology',
      subtitle: 'Neural mechanisms',
    },
    {
      href: '/subjects/pathology',
      icon: <FaVials className="h-5 w-5 text-purple-500" />,
      title: 'Pathology',
      subtitle: 'Disease processes',
    },
    {
      href: '/materials/recent',
      icon: <FaBookMedical className="h-5 w-5 text-green-500" />,
      title: 'Recent Materials',
      subtitle: 'Latest study resources',
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Quick Access</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {quickLinks.map((link, index) => (
          <QuickLink key={index} {...link} />
        ))}
      </div>
    </div>
  );
}
