
import React from 'react';
import { ManagerView } from '../../types';

import {
  LayoutGridIcon,
  CommandLineIcon,
  PuzzlePieceIcon,
  ClipboardListIcon,
  SlidersHorizontalIcon,
  CpuChipIcon,
  ServerIcon,
  FolderIcon,
  MessageSquareIcon,
} from '../ui/Icons';
import { Button } from '../ui/Button';

export interface SidebarProps {
  activeView: ManagerView;
  onNavigate: (view: ManagerView) => void;
  directoryName?: string;
  onChangeDirectory?: () => void;
}

const menuItems = [
  { view: ManagerView.Dashboard, label: 'Dashboard', icon: LayoutGridIcon },
  { view: ManagerView.Chat, label: 'Chat', icon: MessageSquareIcon },
  { view: ManagerView.Agents, label: 'Agents', icon: CpuChipIcon },
  { view: ManagerView.Commands, label: 'Commands', icon: CommandLineIcon },
  { view: ManagerView.Skills, label: 'Skills', icon: PuzzlePieceIcon },
  { view: ManagerView.MCPServers, label: 'MCP Servers', icon: ServerIcon },
  { view: ManagerView.Tasks, label: 'Tasks', icon: ClipboardListIcon },
  { view: ManagerView.Settings, label: 'Settings', icon: SlidersHorizontalIcon },
];

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, directoryName, onChangeDirectory }) => {
  return (
    <aside className="w-64 bg-background border-r border-border flex flex-col p-4">
      <div className="flex items-center gap-2 mb-8">
        <img src="/vite.svg" alt="Claude Icon" className="h-8 w-8" />
        <h1 className="text-xl font-bold">Claude Manager</h1>
      </div>
      <nav className="flex-1">
        <ul>
          {menuItems.map((item) => {
            const isActive = activeView === item.view;
            return (
              <li key={item.view}>
                <button
                  onClick={() => onNavigate(item.view)}
                  className={`w-full flex items-center gap-3 p-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {directoryName && onChangeDirectory && (
        <div className="mt-auto">
          <div className="p-3 rounded-lg bg-secondary">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <FolderIcon className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium truncate" title={directoryName}>
                {directoryName || 'No directory selected'}
              </span>
            </div>
            <Button variant="secondary" size="sm" className="w-full" onClick={onChangeDirectory}>
              Change Directory
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
