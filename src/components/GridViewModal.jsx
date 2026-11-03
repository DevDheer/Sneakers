import { X } from 'lucide-react'

export default function GridViewModal({
  isOpen,
  onClose,
  shoes,
  currentShoeId,
  onSelectShoe,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-[#FAF9F6] rounded-3xl p-8 sm:p-10 shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-neutral-200/80">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-[#EE3135]">
              VSN Archive
            </span>
            <h2 className="text-3xl font-medium tracking-tight text-neutral-900 pt-1">
              All 5 Editions
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-neutral-200/70 hover:bg-neutral-300 flex items-center justify-center text-neutral-700 transition-colors cursor-pointer"
            aria-label="Close grid view"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        {/* 5-Shoe Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
          {shoes.map((item) => {
            const isSelected = item.id === currentShoeId
            return (
              <div
                key={item.id}
                onClick={() => {
                  onSelectShoe(item.id)
                  onClose()
                }}
                className={`group relative p-6 rounded-2xl bg-white border transition-all duration-200 cursor-pointer hover:shadow-lg hover:-translate-y-1 ${
                  isSelected
                    ? 'border-neutral-900 ring-2 ring-neutral-900/10'
                    : 'border-neutral-200/80 hover:border-neutral-400'
                }`}
              >
                {/* Edition tag */}
                <div className="flex items-center justify-between text-xs font-normal text-neutral-400">
                  <span>Edition {item.edition}</span>
                  {isSelected && (
                    <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-white text-[11px] font-medium">
                      Active
                    </span>
                  )}
                </div>

                {/* Sneaker Image */}
                <div className="h-44 flex items-center justify-center py-4">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="max-h-full w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Details */}
                <div className="pt-2">
                  <h3 className="text-lg font-medium text-neutral-900">
                    {item.name}
                  </h3>
                  <p className="text-xs text-neutral-500 line-clamp-2 pt-1 font-normal">
                    {item.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

