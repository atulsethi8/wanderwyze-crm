import React, { useMemo, useState } from "react";
import { Agent, BookingStatus, Docket } from "../types";
import { STATUS_COLORS } from "../constants";
import { formatCurrency, formatDate } from "../services";

interface DashboardProps {
  dockets: Docket[];
  agents: Agent[];
  onSelectDocket: (id: string) => void;
  searchTerm?: string;
}
type ProductFilter = "All Bookings" | "Flights" | "Hotels" | "Packages";

const money = (d: Docket) => {
  const amount = d.invoices?.length
    ? d.invoices.reduce((s, i) => s + (i.grandTotal || 0), 0)
    : [
        ...d.itinerary.flights.flatMap((f) =>
          f.passengerDetails.map((p) => p.grossBilled || 0),
        ),
        ...d.itinerary.hotels.map((h) => h.grossBilled || 0),
        ...d.itinerary.excursions.map((e) => e.grossBilled || 0),
        ...d.itinerary.transfers.map((t) => t.grossBilled || 0),
        d.itinerary.serviceCharge?.grossBilled || 0,
      ].reduce((s, v) => s + v, 0);
  return {
    amount,
    balance: amount - d.payments.reduce((s, p) => s + (p.amount || 0), 0),
  };
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
  const [productFilter, setProductFilter] =
    useState<ProductFilter>("All Bookings");
  const [statusFilter, setStatusFilter] = useState("All"),
    [agentFilter, setAgentFilter] = useState("All");
  const [travelFrom, setTravelFrom] = useState(""),
    [travelTo, setTravelTo] = useState("");
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
        .sort((a, b) => {
          const latestA = new Date(a.docket.updatedAt || a.docket.createdAt || 0).getTime();
          const latestB = new Date(b.docket.updatedAt || b.docket.createdAt || 0).getTime();
          return latestB - latestA;
        }),
    [
      dockets,
      agents,
      searchTerm,
      productFilter,
      statusFilter,
      agentFilter,
      travelFrom,
      travelTo,
    ],
  );
  const outstanding = useMemo(
    () => dockets.reduce((s, d) => s + Math.max(0, money(d).balance), 0),
    [dockets],
  );
  const upcoming = useMemo(
    () =>
      dockets.filter((d) => {
        const date = travelDate(d);
        if (!date) return false;
        const days =
          (new Date(`${date}T00:00:00`).getTime() -
            new Date().setHours(0, 0, 0, 0)) /
          86400000;
        return days >= 0 && days <= 30 && d.status !== BookingStatus.Cancelled;
      }).length,
    [dockets],
  );

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["Total bookings", dockets.length.toString()],
            [
              "Confirmed",
              dockets
                .filter((d) => d.status === BookingStatus.Confirmed)
                .length.toString(),
            ],
            ["Travel in 30 days", upcoming.toString()],
            ["Outstanding", formatCurrency(outstanding)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
            </div>
          ))}
        </div>
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-200">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-800">
                  Booking Queue
                </h1>
                <p className="text-sm text-slate-500">
                  {rows.length} booking{rows.length === 1 ? "" : "s"} shown
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${productFilter === f ? "bg-brand-primary text-white border-brand-primary" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
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
                className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
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
                className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
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
                className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
              <input
                aria-label="Travel to"
                title="Travel to"
                type="date"
                value={travelTo}
                onChange={(e) => setTravelTo(e.target.value)}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Docket No.",
                    "PNR / Booking Ref",
                    "Lead Traveller",
                    "Travel Date",
                    "Booking Date",
                    "Product / Trip Details",
                    "Status",
                    "Amount",
                    "Balance",
                    "Agent",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const s = STATUS_COLORS[r.docket.status];
                  return (
                    <tr
                      key={r.docket.id}
                      onDoubleClick={() => onSelectDocket(r.docket.id)}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-700">
                        {r.docket.docketNo || r.docket.id}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">
                        {r.bookingRef}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <p className="font-semibold text-slate-800">
                          {r.leadTraveller}
                        </p>
                        {r.docket.passengers.length > 1 && (
                          <p className="text-xs text-slate-500">
                            +{r.docket.passengers.length - 1} traveller
                            {r.docket.passengers.length > 2 ? "s" : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {r.travelDate ? formatDate(r.travelDate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {r.docket.createdAt
                          ? formatDate(r.docket.createdAt.slice(0, 10))
                          : "—"}
                      </td>
                      <td
                        className="px-4 py-3 text-sm font-medium text-slate-700 max-w-xs truncate"
                        title={r.product.text}
                      >
                        {r.product.text}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${s.bg} ${s.text}`}
                        >
                          {r.docket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">
                        {formatCurrency(r.amount)}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-bold whitespace-nowrap ${r.balance > 0 ? "text-orange-600" : "text-emerald-700"}`}
                      >
                        {formatCurrency(r.balance)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {r.agent?.name || "Unassigned"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => onSelectDocket(r.docket.id)}
                          className="text-brand-primary hover:underline font-semibold text-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td
                      colSpan={11}
                      className="py-14 text-center text-slate-500"
                    >
                      No bookings match these filters.
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
