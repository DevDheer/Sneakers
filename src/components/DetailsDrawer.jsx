import { X } from 'lucide-react'

export default function DetailsDrawer({ isOpen, onClose, shoe }) {
  if (!isOpen) return null

  return (
    <div className="absolute bottom-16 right-0 w-80 bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border border-neutral-200 z-40 text-left animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-150">
        <div>
          <span className="text-[11px] font-semibold text-[#EE3135] uppercase tracking-wider">
            Specifications
          </span>
          <h4 className="text-base font-medium text-neutral-900">
            {shoe.name}
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-700 text-sm p-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="pt-3 space-y-2.5 text-xs text-neutral-700 font-normal">
        <div>
          <span className="text-neutral-400 block text-[11px]">Upper Construction</span>
          <span className="font-medium text-neutral-800">{shoe.details.upper}</span>
        </div>
        <div>
          <span className="text-neutral-400 block text-[11px]">Outsole Unit</span>
          <span className="font-medium text-neutral-800">{shoe.details.sole}</span>
        </div>
        <div>
          <span className="text-neutral-400 block text-[11px]">Insole Cushioning</span>
          <span className="font-medium text-neutral-800">{shoe.details.insole}</span>
        </div>
        <div>
          <span className="text-neutral-400 block text-[11px]">Collar Lining</span>
          <span className="font-medium text-neutral-800">{shoe.details.lining}</span>
        </div>
        <div className="pt-2 border-t border-neutral-100 flex justify-between text-[11px] text-neutral-400">
          <span>Product SKU</span>
          <span className="font-mono text-neutral-600">{shoe.details.sku}</span>
        </div>
      </div>
    </div>
  )
}

