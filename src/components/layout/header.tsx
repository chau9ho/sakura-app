import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const Header: React.FC = () => {
  return (
    <header className="bg-secondary shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
           {/* Placeholder for Logo - replace with actual logo if available */}
           <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xl">
              🌸
            </div>
          <h1 className="text-xl font-semibold text-primary-foreground">
             Sakura Studio
          </h1>
        </Link>
        {/* Future navigation items can go here */}
        <div>
            {/* Example: <Button variant="ghost">Settings</Button> */}
        </div>
      </div>
    </header>
  );
};

export default Header;
