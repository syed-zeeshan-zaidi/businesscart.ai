interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Wrapper alignment. UserForm centres its control, every other list right-aligns. */
  align?: 'end' | 'center';
  className?: string;
}

/** Numbers shown once the list is long enough to need an ellipsis: 1, five middle, last. */
const SLOTS = 7;
/**
 * Below this the window would hide only one or two pages, and an ellipsis that
 * stands for a single page is wider than the button it replaced. So render
 * everything, exactly as the portal did before this component existed.
 */
const SHOW_ALL_UPTO = 9;

/**
 * Page numbers to render, with `null` standing in for an ellipsis.
 *
 * At `SHOW_ALL_UPTO` pages or fewer this returns every page. Above that it
 * always returns exactly `SLOTS` numbers: the first, the last, and a run of
 * five containing the current page. The count does not change as you page
 * through, so the control keeps a fixed width and buttons do not shift under
 * the cursor. Every ellipsis stands for at least two hidden pages.
 *
 * This is the point of the component: a 277 product catalog at 10 a page is 28
 * buttons, and every list view in the portal used to render all of them.
 */
export function pageWindow(currentPage: number, totalPages: number): (number | null)[] {
  if (totalPages <= SHOW_ALL_UPTO) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const span = SLOTS - 2; // middle run, first and last are always shown
  let start = currentPage - Math.floor(span / 2);
  let end = start + span - 1;

  // Butt the run against whichever end it is near. Anchoring at 2 (rather than
  // 3) and at totalPages-1 is what guarantees a gap never hides a single page.
  if (start <= 3) {
    start = 2;
    end = start + span - 1;
  } else if (end >= totalPages - 2) {
    end = totalPages - 1;
    start = end - span + 1;
  }

  const out: (number | null)[] = [1];
  if (start > 2) out.push(null);
  for (let p = start; p <= end; p++) out.push(p);
  if (end < totalPages - 1) out.push(null);
  out.push(totalPages);
  return out;
}

const BTN = 'px-3 py-1 border border-gray-300 rounded-md text-sm font-medium tabular-nums';

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  align = 'end',
  className = 'mt-2',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className={`${className} flex flex-wrap gap-2 ${align === 'center' ? 'justify-center' : 'justify-end'}`}
    >
      <button
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className={`${BTN} text-gray-700 hover:bg-gray-50 disabled:opacity-50`}
      >
        Previous
      </button>

      {pageWindow(currentPage, totalPages).map((page, i) =>
        page === null ? (
          <span key={`gap-${i}`} className="px-2 py-1 text-sm text-gray-400 select-none">
            &hellip;
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            aria-current={currentPage === page ? 'page' : undefined}
            className={`${BTN} ${
              currentPage === page ? 'bg-teal-700 text-white border-teal-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className={`${BTN} text-gray-700 hover:bg-gray-50 disabled:opacity-50`}
      >
        Next
      </button>
    </nav>
  );
}
