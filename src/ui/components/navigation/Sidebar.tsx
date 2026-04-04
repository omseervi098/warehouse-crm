
import { BetweenHorizontalEndIcon, IndianRupee, ReceiptText, Warehouse } from 'lucide-react';
import React from 'react';
import { NavLink } from 'react-router-dom';
//@ts-ignore
import Icon from "../../../assets/logo_transparent.png";
import { DarkModeToggle } from '../common/DarkModeToggle';
const commonLinkClasses = "flex items-center px-4 py-3 text-slate-200 hover:bg-white/10 transition-colors duration-150 rounded-lg hover:text-white";
const activeLinkClasses = "bg-white/10 text-white font-semibold";


interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isExpanded: boolean;
  isCompact?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, isExpanded, isCompact = false }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `${commonLinkClasses} ${isCompact ? 'py-2.5' : ''} ${isActive ? activeLinkClasses : ''} ${!isExpanded ? 'justify-center' : ''}`}
    title={isExpanded ? undefined : label}
  >
    <span className={`h-5 w-5 shrink-0 ${isExpanded ? 'mr-3' : 'mr-0'}`}>{icon}</span>
    <span className={`${isExpanded ? 'inline' : 'hidden'}`}>{label}</span>
  </NavLink>
);

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isMacOS?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, isMacOS = false }) => {
  // Simple SVG icons
  const DashboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
  const ProfileIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
  const ItemIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
  const PartyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.273-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.273.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
  const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.573-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  const CollapseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>;
  const ExpandIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>;
  const CloseIcon = () => <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;


  return (
    <>
      {/* Mobile Overlay */}
      <div onClick={() => setIsOpen(false)} className={`fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} aria-hidden="true" />

      <aside className={`
            bg-theme-sidebar text-white flex flex-col
            fixed md:relative inset-y-0 left-0 z-40
            transition-all duration-300 ease-in-out shadow-lg
            ${isOpen ? 'w-64' : 'w-0 md:w-20'}
            ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            border-r border-white/10
            ${isMacOS ? 'macos-sidebar' : ''}
        `}>
        <div className="flex min-h-0 flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className={`flex items-center justify-between h-20 shrink-0 border-b border-white/10 ${isOpen ? 'px-4' : 'md:px-0 md:justify-center'} ${isMacOS ? 'macos-sidebar-header' : ''}`}>
            <h1 className={`text-xl md:text-xl font-bold tracking-wider text-white whitespace-nowrap flex items-center gap-2`}>
              <img src={Icon} alt="Logo" className={`h-10 w-10 ${isMacOS ? 'rounded-xl bg-white/5 p-1' : ''}`} />
              {/* @ts-ignore */}
              <span className='text-lg'>{isOpen && (import.meta.env.VITE_APP_NAME || "Warehouse CRM")}</span>
            </h1>
            <button onClick={() => setIsOpen(false)} className="md:hidden p-2 text-white hover:bg-white/10 rounded-full" aria-label="Close sidebar">
              <CloseIcon />
            </button>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 min-h-0 overflow-y-auto px-2 py-4 space-y-1 ${isMacOS ? 'macos-sidebar-nav' : ''}`}>
            <NavItem to="/dashboard" icon={<DashboardIcon />} label="Dashboard" isExpanded={isOpen} isCompact={isMacOS} />
            <NavItem to="/company-profile" icon={<ProfileIcon />} label="Company Profile" isExpanded={isOpen} isCompact={isMacOS} />
            <NavItem to="/master-data" icon={<ItemIcon />} label="Master Data" isExpanded={isOpen} isCompact={isMacOS} />
            <NavItem to="/parties" icon={<PartyIcon />} label="Parties" isExpanded={isOpen} isCompact={isMacOS} />
            <NavItem to="/stock-management/entries" icon={<BetweenHorizontalEndIcon size={20} />} label="Stock Entries" isExpanded={isOpen} isCompact={isMacOS} />
            <NavItem to="/stock-statements/balance" icon={<Warehouse size={20} />} label="Stock Balance" isExpanded={isOpen} isCompact={isMacOS} />
            <NavItem to="/warehouse-charges" icon={<IndianRupee size={20} />} label="Warehouse Charges" isExpanded={isOpen} isCompact={isMacOS} />
            <NavItem to="/billing" icon={<ReceiptText size={20} />} label="Billing" isExpanded={isOpen} isCompact={isMacOS} />
            <NavItem to="/settings" icon={<SettingsIcon />} label="Settings" isExpanded={isOpen} isCompact={isMacOS} />
          </nav>

          {/* Footer Toggle */}
          <div className={`w-full shrink-0 border-t border-white/10 px-2 pt-2 ${isMacOS ? 'macos-sidebar-footer' : ''}`}>
            <DarkModeToggle isExpanded={isOpen} />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`hidden md:flex items-center w-full px-4 py-2 text-slate-300 hover:text-white hover:bg-white/10 transition-colors hover:rounded-md ${!isOpen ? 'justify-center h-11 w-11 mx-auto px-0 py-0 rounded-lg' : ''}`}
              title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              <div className="h-6 w-6 shrink-0">{isOpen ? <CollapseIcon /> : <ExpandIcon />}</div>
              <span className={`ml-3 whitespace-nowrap ${isOpen ? 'inline' : 'hidden'}`}>Collapse</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
