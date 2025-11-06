
import React from 'react';
import Sidebar, { SidebarProps } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  sidebarProps: SidebarProps;
  noContainer?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, sidebarProps, noContainer = false }) => {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar {...sidebarProps} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {noContainer ? (
          children
        ) : (
          <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 overflow-y-auto flex-1">
            {children}
          </div>
        )}
      </main>
    </div>
  );
};

export default Layout;
