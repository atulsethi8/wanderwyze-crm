import React, { useMemo, useState } from "react";
import { Agent, BookingStatus, Docket } from "../types";
import { useAuth } from "../hooks";
import { formatCurrency, formatDate } from "../services";
import { calculateDocketTotals } from "../services/docketTotals";
import { EmptyState } from "./common";
import {
  COLUMNS,
  DEFAULT_SORT,
  compareRows,
  nextSort,
  type SortDirection,
  type SortKey,
} from "./dashboardSort";

interface DashboardProps {
  dockets: Docket[];
  agents: Agent[];
  onSelectDocket: (id: string) => void;
  searchTerm?: string;
}
type ProductFilter = "All Bookings" | "Flights" | "Hotels" | "Packages";

const money = (d: Docket) => {
  const { grossBilled, balance, profit } = calculateDocketTotals(d);
  return { amount: grossBilled, balance, profit };
};
const travelDate = (d: Docket) =>
  [
    ...d.itinerary.flights.map(
      (f) => f.sectors?.[0]?.departureDate || f.departureDate,
    ),
    ...d.itinerary.hotels.map((h) => h.checkIn),
    ...d.itinerary.excursions.map((e) => e.date),
    ...d.itinerary.transfers.map((t) => t.date),
  ]
    .filter(Boolean)
    .sort()[0] || "";
const product = (d: Docket) => {
  const { flights, hotels, excursions, transfers } = d.itinerary;
  if (
    (flights.length && hotels.length) ||
    excursions.length ||
    transfers.length
  ) {
    const destination =
      flights[0]?.sectors?.at(-1)?.arrivalAirport ||
      flights[0]?.arrivalAirport ||
      hotels[0]?.city ||
      hotels[0]?.name ||
      "Trip";
    return {
      type: "Packages" as const,
      text: `✈ + 🏨 ${destination} Package`,
    };
  }
  if (flights.length) {
    const f = flights[0],
      first = f.sectors?.[0],
      last = f.sectors?.at(-1);
    return {
      type: "Flights" as const,
      text: `✈ ${first?.departureAirport || f.departureAirport || "—"} → ${last?.arrivalAirport || f.arrivalAirport || "—"} • ${f.tripType || (f.returnDate ? "Return" : "One Way")}`,
    };
  }
  if (hotels.length) {
    const h = hotels[0],
      nights =
        h.checkIn && h.checkOut
          ? Math.max(
              0,
              Math.round(
                (new Date(h.checkOut).getTime() -
                  new Date(h.checkIn).getTime()) /
                  86400000,
              ),
            )
          : 0;
    return {
      type: "Hotels" as const,
      text: `🏨 ${h.name || "Hotel"}${nights ? ` • ${nights}N` : ""}`,
    };
  }
  return { type: "Packages" as const, text: "Trip details pending" };
};
const bookingRef = (d: Docket) =>
  d.itinerary.flights.find((f) => f.pnr)?.pnr ||
  d.itinerary.flights.find((f) => f.bookingId)?.bookingId ||
  d.itinerary.hotels.find((h) => h.confirmationNumber)?.confirmationNumber ||
  "—";

export const Dashboard: React.FC<DashboardProps> = ({
  dockets,
  agents,
  onSelectDocket,
  searchTerm = "",
}) => {
  const { currentUser } = useAuth();
  const canViewProfit = currentUser?.role === "admin";
  const dashboardColumns = COLUMNS.filter((column) => canViewProfit || column.sortKey !== "profit");
  const [productFilter, setProductFilter] =
    useState<ProductFilter>("All Bookings");
  const [statusFilter, setStatusFilter] = useState("All"),
    [agentFilter, setAgentFilter] = useState("All");
  const [travelFrom, setTravelFrom] = useState(""),
    [travelTo, setTravelTo] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>(DEFAULT_SORT);
  const toggleSort = (key: SortKey) => setSort((current) => nextSort(current, key));

  const rows = useMemo(
    () =>
      dockets
        .map((docket) => ({
          docket,
          product: product(docket),
          ...money(docket),
          bookingRef: bookingRef(docket),
          leadTraveller: docket.passengers[0]?.fullName || docket.client.name,
          travelDate: travelDate(docket),
          agent: agents.find((a) => a.id === docket.agentId),
        }))
        .filter((row) => {
          const q = searchTerm.trim().toLowerCase();
          const match =
            !q ||
            [
              row.docket.docketNo,
              row.docket.id,
              row.bookingRef,
              row.leadTraveller,
              row.docket.client.name,
              row.product.text,
              row.agent?.name,
            ].some((v) => v?.toLowerCase().includes(q)) ||
            row.docket.searchTags?.some((t) => t.toLowerCase().includes(q));
          return (
            match &&
            (productFilter === "All Bookings" ||
              row.product.type === productFilter) &&
            (statusFilter === "All" || row.docket.status === statusFilter) &&
            (agentFilter === "All" || row.docket.agentId === agentFilter) &&
            (!travelFrom ||
              (!!row.travelDate && row.travelDate >= travelFrom)) &&
            (!travelTo || (!!row.travelDate && row.travelDate <= travelTo))
          );
        })
        .sort((a, b) => compareRows(a, b, sort.key, sort.direction)),
    [
      dockets,
      agents,
      searchTerm,
      productFilter,
      statusFilter,
      agentFilter,
      travelFrom,
      travelTo,
      sort,
    ],
  );
  // All dashboard totals come from the same filtered booking rows as the table.
  const totals = useMemo(
    () => rows.reduce(
      (sum, row) => ({
        gross: sum.gross + row.amount,
        profit: sum.profit + row.profit,
        outstanding: sum.outstanding + Math.max(0, row.balance),
      }),
      { gross: 0, profit: 0, outstanding: 0 },
    ),
    [rows],
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink tracking-tight">Dashboard</h1>
          <p className="text-sm text-ink-muted mt-1">
            An overview of your bookings and what needs attention.
          </p>
        </div>

        {/* Stat tiles. The accent bar gives the row a spine without adding colour noise. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ["Total bookings", rows.length.toString(), false],
            ["Total Gross", formatCurrency(totals.gross), false],
            ...(canViewProfit ? [["Total Profit", formatCurrency(totals.profit), totals.profit < 0] as const] : []),
            ["Outstanding", formatCurrency(totals.outstanding), totals.outstanding > 0],
          ].map(([label, value, alert]) => (
            <div
              key={label as string}
              className="relative bg-surface border border-line rounded-xl px-5 py-4 shadow-card overflow-hidden"
            >
              <span
                className={`absolute inset-y-0 left-0 w-1 ${alert ? "bg-accent" : "bg-line"}`}
              />
              <p className="text-label font-semibold uppercase text-ink-subtle">{label}</p>
              <p
                className={`mt-1.5 text-[26px] leading-none font-semibold tabular tracking-tight ${
                  alert ? "text-accent-hover" : "text-ink"
                }`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        <section className="bg-surface border border-line rounded-xl shadow-card overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-line">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-ink tracking-tight">
                  Booking Queue
                </h2>
                <p className="text-sm text-ink-muted mt-0.5">
                  {rows.length} booking{rows.length === 1 ? "" : "s"} shown
                </p>
              </div>
              {/* Segmented control: one bordered group reads as a single choice, where
                  four separate pills read as four independent toggles. */}
              <div className="inline-flex bg-canvas border border-line rounded-lg p-0.5">
                {(
                  [
                    "All Bookings",
                    "Flights",
                    "Hotels",
                    "Packages",
                  ] as ProductFilter[]
                ).map((f) => (
                  <button
                    key={f}
                    onClick={() => setProductFilter(f)}
                    aria-pressed={productFilter === f}
                    className={`px-3 py-1.5 rounded-[6px] text-sm font-medium transition-colors ${productFilter === f ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm bg-surface text-ink transition-colors hover:border-slate-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              >
                <option>All</option>
                {Object.values(BookingStatus).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Filter by agent"
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm bg-surface text-ink transition-colors hover:border-slate-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              >
                <option value="All">All agents</option>
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="Travel from"
                title="Travel from"
                type="date"
                value={travelFrom}
                onChange={(e) => setTravelFrom(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm bg-surface text-ink transition-colors hover:border-slate-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
              <input
                aria-label="Travel to"
                title="Travel to"
                type="date"
                value={travelTo}
                onChange={(e) => setTravelTo(e.target.value)}
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm bg-surface text-ink transition-colors hover:border-slate-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </div>
          <div className="overflow-x-auto scroll-slim">
            <table className="min-w-[1280px] w-full">
              <thead className="bg-canvas border-b border-line">
                <tr>
                  {dashboardColumns.map((column) => {
                    const active = column.sortKey && sort.key === column.sortKey;
                    return (
                      <th
                        key={column.label}
                        aria-sort={
                          active
                            ? sort.direction === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                        className="px-4 py-2.5 text-left text-label font-semibold text-ink-subtle uppercase whitespace-nowrap"
                      >
                        {column.sortKey ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column.sortKey!)}
                            title={`Sort by ${column.label}`}
                            className={`group inline-flex items-center gap-1 uppercase transition-colors hover:text-ink ${active ? "text-ink" : ""}`}
                          >
                            {column.label}
                            <span
                              aria-hidden="true"
                              className={
                                active
                                  ? "text-accent"
                                  : "text-line-strong group-hover:text-ink-subtle"
                              }
                            >
                              {active ? (sort.direction === "asc" ? "▲" : "▼") : "▾"}
                            </span>
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  return (
                    <tr
                      key={r.docket.id}
                      onDoubleClick={() => onSelectDocket(r.docket.id)}
                      className="hover:bg-canvas transition-colors cursor-default"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-ink tabular whitespace-nowrap">
                        {r.docket.docketNo || r.docket.id}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted font-medium tabular whitespace-nowrap">
                        {r.bookingRef}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium text-ink">
                          {r.leadTraveller}
                        </p>
                        {r.docket.passengers.length > 1 && (
                          <p className="text-xs text-ink-subtle mt-0.5">
                            +{r.docket.passengers.length - 1} traveller
                            {r.docket.passengers.length > 2 ? "s" : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted whitespace-nowrap tabular">
                        {r.travelDate ? formatDate(r.travelDate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-muted whitespace-nowrap tabular">
                        {r.docket.createdAt
                          ? formatDate(r.docket.createdAt.slice(0, 10))
                          : "—"}
                      </td>
                      <td
                        className="px-4 py-3 text-sm text-ink-muted max-w-xs truncate"
                        title={r.product.text}
                      >
                        {r.product.text}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-ink whitespace-nowrap tabular text-right">
                        {formatCurrency(r.amount)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-semibold whitespace-nowrap tabular text-right ${r.balance > 0 ? "text-accent-hover" : "text-ink-subtle"}`}
                      >
                        {formatCurrency(r.balance)}
                      </td>
                      {canViewProfit && (
                        <td className={`px-4 py-3 text-sm font-semibold whitespace-nowrap tabular text-right ${r.profit < 0 ? "text-red-600" : "text-ink"}`}>
                          {formatCurrency(r.profit)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-ink-muted whitespace-nowrap">
                        {r.agent?.name || <span className="text-ink-subtle">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => onSelectDocket(r.docket.id)}
                          className="text-sm font-semibold text-brand hover:text-brand-hover hover:underline"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length > 0 && (
                  <tr className="bg-canvas border-t-2 border-line font-semibold">
                    <td colSpan={6} className="px-4 py-3 text-sm text-ink">TOTAL ({rows.length} bookings)</td>
                    <td className="px-4 py-3 text-sm text-ink tabular text-right whitespace-nowrap">{formatCurrency(totals.gross)}</td>
                    <td className="px-4 py-3 text-sm text-accent-hover tabular text-right whitespace-nowrap">{formatCurrency(totals.outstanding)}</td>
                    {canViewProfit && (
                      <td className={`px-4 py-3 text-sm tabular text-right whitespace-nowrap ${totals.profit < 0 ? "text-red-600" : "text-ink"}`}>{formatCurrency(totals.profit)}</td>
                    )}
                    <td colSpan={2}></td>
                  </tr>
                )}
                {!rows.length && (
                  <tr>
                    <td colSpan={dashboardColumns.length} className="p-0">
                      <EmptyState
                        title="No bookings match these filters"
                        description="Try clearing the status, agent or travel-date filters, or search for a different traveller."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
