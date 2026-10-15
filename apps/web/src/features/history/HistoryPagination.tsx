interface HistoryPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function buildWindowedPages(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 1) return [];

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  if (currentPage - 1 >= 1) pages.add(currentPage - 1);
  pages.add(currentPage);
  if (currentPage + 1 <= totalPages) pages.add(currentPage + 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);

  const result: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev !== undefined && curr - prev > 1) {
      result.push("ellipsis");
    }
    result.push(curr);
  }
  return result;
}

const NAV_BASE =
  "inline-flex items-center justify-center rounded-lg font-medium transition-all text-sm px-2.5 py-1.5 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none";

const NAV_FLAT = `${NAV_BASE} bg-transparent text-text-primary hover:bg-surface-elevated`;
const NAV_ACTIVE = `${NAV_BASE} bg-accent text-text-inverse shadow-[var(--shadow-glow-accent)]`;
const NAV_NUMBER = `${NAV_BASE} bg-transparent text-text-primary hover:bg-surface-elevated min-w-[2rem]`;

export function HistoryPagination({
  currentPage,
  totalPages,
  onPageChange,
}: HistoryPaginationProps): JSX.Element | null {
  if (totalPages <= 1) return null;

  const pages = buildWindowedPages(currentPage, totalPages);
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  return (
    <nav aria-label="Game history pagination" className="flex items-center justify-center gap-1 pt-3 pb-1">
      <button
        className={NAV_FLAT}
        onClick={() => onPageChange(1)}
        disabled={isFirst}
        aria-label="First page"
      >
        «
      </button>
      <button
        className={NAV_FLAT}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirst}
        aria-label="Previous page"
      >
        ‹
      </button>

      {pages.map((item, i) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-text-secondary text-sm select-none">
            …
          </span>
        ) : (
          <button
            key={item}
            className={item === currentPage ? NAV_ACTIVE : NAV_NUMBER}
            onClick={() => onPageChange(item)}
            aria-label={`Page ${item}`}
            aria-current={item === currentPage ? "page" : undefined}
          >
            {item}
          </button>
        ),
      )}

      <button
        className={NAV_FLAT}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLast}
        aria-label="Next page"
      >
        ›
      </button>
      <button
        className={NAV_FLAT}
        onClick={() => onPageChange(totalPages)}
        disabled={isLast}
        aria-label="Last page"
      >
        »
      </button>
    </nav>
  );
}
