'use client';

import React, { useRef, useEffect } from 'react';
import type { User as SharedUser } from '@/shared/types/authInterface';
import Link from 'next/link';
import { User, Settings, LogOut } from 'lucide-react';
import { healthcareProfileLabel } from '@/shared/utils/healthcareProfile';

interface UserMenuProps {
    user: Partial<SharedUser> | null | undefined;
    logout: () => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    direction?: 'up' | 'down';
    className?: string;
}

export const UserMenu: React.FC<UserMenuProps> = ({
    user,
    logout,
    isOpen,
    setIsOpen,
    direction = 'down',
    className = '',
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [isLoggingOut, setIsLoggingOut] = React.useState(false);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen, setIsOpen]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className={`absolute ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
                } right-0 w-64 bg-card dark:bg-card rounded-2xl shadow-2xl py-2 z-50 border border-border dark:border-border ${className}`}
            role="menu"
        >
            <div className="px-5 py-4 border-b border-border dark:border-border bg-background/50 dark:bg-card/20 rounded-t-2xl">
                <p className="text-sm font-bold text-foreground dark:text-foreground truncate">
                    {user?.firstName && user?.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user?.firstName || 'User'}
                </p>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate mt-0.5">
                    {user?.email}
                </p>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate mt-1">
                    {healthcareProfileLabel(user ?? {})}
                </p>
            </div>

            <div className="py-1">
                <Link
                    href="/profile"
                    className="flex items-center px-4 py-2 text-sm text-muted-foreground dark:text-muted-foreground hover:bg-background dark:hover:bg-secondary transition-colors"
                    onClick={() => setIsOpen(false)}
                    role="menuitem"
                >
                    <User className="mr-3 h-4 w-4 text-muted-foreground" />
                    Profile
                </Link>
                <Link
                    href="/settings"
                    className="flex items-center px-4 py-2 text-sm text-muted-foreground dark:text-muted-foreground hover:bg-background dark:hover:bg-secondary transition-colors"
                    onClick={() => setIsOpen(false)}
                    role="menuitem"
                >
                    <Settings className="mr-3 h-4 w-4 text-muted-foreground" />
                    Settings
                </Link>
            </div>

            <div className="border-t border-border dark:border-border py-1">
                <button
                    onClick={async () => {
                        if (isLoggingOut) return;
                        setIsLoggingOut(true);
                        try {
                            await logout();
                        } catch (err) {
                            console.error('Logout failed:', err);
                            setIsLoggingOut(false);
                        }
                    }}
                    disabled={isLoggingOut}
                    className={`w-full text-left flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors ${
                        isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    role="menuitem"
                >
                    <LogOut className={`mr-3 h-4 w-4 ${isLoggingOut ? 'animate-pulse' : ''}`} />
                    {isLoggingOut ? 'Logging out...' : 'Log Out'}
                </button>
            </div>
        </div>
    );
};
