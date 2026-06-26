export default function AdminSidebarBrand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0F3D5C] text-sm font-black tracking-tighter text-white shadow-lg">
        SK
      </div>
      <div>
        <div className="text-sm font-semibold leading-tight">SKonnect</div>
        <div className="text-xs text-slate-500">Admin workspace</div>
      </div>
    </div>
  );
}
