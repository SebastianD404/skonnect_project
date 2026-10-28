import { SkLogo } from "@/app/components/SkLogo";

export default function AdminSidebarBrand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <SkLogo className="h-10 w-10" />
      <div>
        <div className="text-sm font-semibold leading-tight">SKonnect</div>
        <div className="text-xs text-slate-500">Admin workspace</div>
      </div>
    </div>
  );
}
