import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const Header: React.FC = () => {
  return (
    <header className="bg-secondary shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between"> {/* Reduced py */}
        <Link href="/" className="flex items-center gap-2"> {/* Reduced gap */}
           {/* Placeholder for Logo */}
           <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg"> {/* Smaller logo */}
              🌸
            </div>
          <h1 className="text-lg font-semibold text-primary-foreground"> {/* Smaller title */}
             櫻の畫室
          </h1>
        </Link>
        {/* Future navigation items can go here */}
        <div>
            {/* Example: <Button variant="ghost" size="sm">設定</Button> */}
        </div>
      </div>
    </header>
  );
};

export default Header;
