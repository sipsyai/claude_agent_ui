
import React from 'react';
import Sidebar, { SidebarProps } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  sidebarProps: SidebarProps;
}

const Layout: React.FC<LayoutProps> = ({ children, sidebarProps }) => {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar {...sidebarProps} />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
            {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
