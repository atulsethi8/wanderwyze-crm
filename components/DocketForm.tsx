import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Docket,
  Client,
  Itinerary,
  Passenger,
  Flight,
  Hotel,
  Excursion,
  Transfer,
  Payment,
  UploadedFile,
  Comment,
  BookingStatus,
  Tag,
  PaymentType,
  Supplier,
  PassengerType,
  Gender,
  LeadSource,
  FlightPassengerDetail,
  Invoice,
  Agent,
  FlightSector,
  FlightTripType,
} from "../types";
import { INITIAL_DOCKET_FORM_STATE, LEAD_SOURCES } from "../constants";
import {
  formatCurrency,
  formatDate,
  getNumberOfNights,
  toBase64,
  amountToWords,
  formatDateTimeIST,
} from "../services";
import { extractDocumentData, explainExtractionFailure } from "../services/documentExtraction";
import { parseETicketText } from "../services/ticketParser";
import { parseHotelVoucherText } from "../services/voucherParser";
import { useAuth } from "../hooks";
import {
  Icons,
  Modal,
  Spinner,
  FormInput,
  FormTextarea,
  FormSelect,
  EmptyState,
  Badge,
  Button,
} from "./common";
import { InvoiceGenerator } from "./InvoiceGenerator";
import { ZohoInvoicePanel, ZohoInvoiceStatusRow } from "./ZohoInvoicePanel";

const createSector = (seed: Partial<FlightSector> = {}): FlightSector => ({
  id: seed.id || `SEC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  airline: seed.airline || "",
  flightNumber: seed.flightNumber || "",
  departureDate: seed.departureDate || "",
  departureTime: seed.departureTime || "",
  arrivalDate: seed.arrivalDate || "",
  arrivalTime: seed.arrivalTime || "",
  departureAirport: seed.departureAirport || "",
  arrivalAirport: seed.arrivalAirport || "",
});

const normalizeFlight = (flight: Flight): Flight => {
  const legacySector = createSector({
    airline: flight.airline,
    flightNumber: flight.flightNumber,
    departureDate: flight.departureDate,
    departureTime: flight.departureTime,
    arrivalDate: flight.arrivalDate,
    arrivalTime: flight.arrivalTime,
    departureAirport: flight.departureAirport,
    arrivalAirport: flight.arrivalAirport,
  });
  const sectors = flight.sectors?.length
    ? flight.sectors.map(createSector)
    : [legacySector];
  return {
    ...flight,
    tripType: flight.tripType || (flight.returnDate ? "Return" : "One Way"),
    sectors,
  };
};

const syncLegacyFlightFields = (
  flight: Flight,
  sectors: FlightSector[],
): Flight => {
  const first = sectors[0] || createSector();
  return {
    ...flight,
    sectors,
    airline: first.airline,
    flightNumber: first.flightNumber,
    departureDate: first.departureDate,
    departureTime: first.departureTime,
    arrivalDate: first.arrivalDate,
    arrivalTime: first.arrivalTime,
    departureAirport: first.departureAirport,
    arrivalAirport: first.arrivalAirport,
  };
};

interface DocketFormProps {
  docket: Docket | null;
  onSave: (
    docketData: Omit<Docket, "id" | "searchTags" | "createdAt" | "updatedAt">,
    id?: string,
  ) => Promise<void>;
  onDelete: (id: string, reason: string) => void;
  onClose: () => void;
  suppliers: Supplier[];
  saveSupplier: (supplier: Omit<Supplier, "id">) => void;
  agents: Agent[];
  loading: boolean;
  forceReadOnly?: boolean;
  readOnlyBanner?: string;
}

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  bgClass?: string;
}> = ({ title, icon, children, defaultOpen = true, bgClass = "bg-white" }) => (
  <details
    open={defaultOpen}
    className={`${bgClass} rounded-lg shadow-sm border border-slate-200 mb-4`}
  >
    <summary className="px-5 py-4 cursor-pointer flex items-center justify-between font-semibold text-slate-800">
      <div className="flex items-center gap-3 text-slate-800">
        <span className="inline-flex items-center justify-center w-6 h-6 text-slate-600">
          {icon}
        </span>
        <span className="text-base">{title}</span>
      </div>
      <span className="text-slate-500 transform transition-transform duration-200 group-open:rotate-180">
        {Icons.chevronDown}
      </span>
    </summary>
    <div className="p-5 border-t border-slate-200">{children}</div>
  </details>
);

const NewPaymentForm: React.FC<{
  onAddPayment: (p: Omit<Payment, "id">) => Promise<void>;
  disabled: boolean;
}> = ({ onAddPayment, disabled }) => {
  const [amount, setAmount] = useState<number | "">("");
  const [type, setType] = useState(PaymentType.BankTransfer);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount && +amount > 0 && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onAddPayment({ amount: +amount, type, date, notes });
        setAmount("");
        setNotes("");
      } catch (error) {
        console.error("Failed to add payment:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-slate-100 rounded-lg grid grid-cols-2 gap-4 items-end"
    >
      <div className="col-span-2">
        <FormInput
          label="Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value ? +e.target.value : "")}
          required
          disabled={disabled || isSubmitting}
        />
      </div>
      <FormSelect
        label="Payment Type"
        value={type}
        onChange={(e) => setType(e.target.value as PaymentType)}
        disabled={disabled || isSubmitting}
      >
        {Object.values(PaymentType).map((t) => (
          <option key={t}>{t}</option>
        ))}
      </FormSelect>
      <FormInput
        label="Date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        icon={Icons.calendar}
        disabled={disabled || isSubmitting}
      />
      <div className="col-span-2">
        <FormInput
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled || isSubmitting}
        />
      </div>
      <div className="col-span-2">
        <button
          type="submit"
          className="w-full bg-green-600 text-white font-semibold py-2 rounded-md hover:bg-green-700 disabled:bg-slate-400 flex items-center justify-center gap-2"
          disabled={disabled || isSubmitting || !amount || +amount <= 0}
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            "Add Payment"
          )}
        </button>
      </div>
    </form>
  );
};

const NewCommentForm: React.FC<{
  onAddComment: (text: string) => Promise<void>;
}> = ({ onAddComment }) => {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onAddComment(text);
        setText("");
      } catch (error) {
        console.error("Failed to add comment:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <FormInput
        label=""
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment..."
        className="w-full"
        disabled={isSubmitting}
      />
      <button
        type="submit"
        disabled={isSubmitting || !text.trim()}
        className="px-4 py-2 bg-brand-primary text-white font-semibold rounded-md disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Saving...
          </>
        ) : (
          "Add"
        )}
      </button>
    </form>
  );
};

// --- MODAL CONTENT FOR ADDING PAX TO FLIGHT ---
const AddPaxToFlightModalContent: React.FC<{
  availablePassengers: Passenger[];
  onAdd: (selectedIds: string[]) => void;
  onCancel: () => void;
}> = ({ availablePassengers, onAdd, onCancel }) => {
  const [selected, setSelected] = useState<string[]>([]);

  const handleToggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleConfirm = () => {
    onAdd(selected);
  };

  return (
    <div>
      <div className="space-y-2 max-h-60 overflow-y-auto p-1">
        {availablePassengers.length > 0 ? (
          availablePassengers.map((pax) => (
            <label
              key={pax.id}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(pax.id)}
                onChange={() => handleToggle(pax.id)}
                className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
              />
              {pax.fullName}
            </label>
          ))
        ) : (
          <p className="text-slate-500 text-center py-4">
            All passengers in the docket are already added to this flight.
          </p>
        )}
      </div>
      <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-200 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={selected.length === 0}
          className="px-4 py-2 bg-brand-primary text-white rounded-md disabled:bg-slate-400"
        >
          Add Selected
        </button>
      </div>
    </div>
  );
};

// --- MAIN DOCKET FORM COMPONENT ---
export const DocketForm: React.FC<DocketFormProps> = ({
  docket,
  onSave,
  onDelete,
  onClose,
  suppliers,
  saveSupplier,
  agents,
  loading: isSaving,
  forceReadOnly,
  readOnlyBanner,
}) => {
  const { currentUser } = useAuth();
  const [formState, setFormState] = useState<
    Omit<Docket, "id" | "searchTags" | "createdAt" | "updatedAt">
  >(INITIAL_DOCKET_FORM_STATE);
  const [activeTab, setActiveTab] = useState("details");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [zohoModalOpen, setZohoModalOpen] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState<Omit<Supplier, "id">>({
    name: "",
    contactPerson: "",
    contactNumber: "",
  });
  const [addPaxToFlightIndex, setAddPaxToFlightIndex] = useState<number | null>(
    null,
  );
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const notificationTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const computedReadOnly = useMemo(() => {
    if (!docket || !currentUser) return false; // New dockets are always editable
    return currentUser.role !== "admin" && docket.createdBy !== currentUser.id;
  }, [docket, currentUser]);
  const isReadOnly = forceReadOnly ? true : computedReadOnly;

  useEffect(() => {
    if (docket) {
      const copy = JSON.parse(JSON.stringify(docket));
      copy.itinerary.flights = (copy.itinerary.flights || []).map(
        normalizeFlight,
      );
      copy.itinerary.hotels = (copy.itinerary.hotels || []).map(
        (hotel: Hotel) => ({ paxRefs: [], ...hotel }),
      );
      copy.files = copy.files || [];
      setFormState(copy); // Normalize new fields while retaining legacy docket data
    } else {
      setFormState(INITIAL_DOCKET_FORM_STATE);
    }
  }, [docket?.id]); // Only re-initialize when the docket ID changes, not on every re-render

  useEffect(() => {
    return () => {
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    };
  }, []);

  const handleClientChange = <T extends keyof Client>(
    field: T,
    value: Client[T],
  ) => {
    setFormState((prev) => ({
      ...prev,
      client: { ...prev.client, [field]: value },
    }));
  };

  const handleArrayChange = useCallback(
    (
      category: keyof Itinerary,
      indexToUpdate: number,
      field: string,
      value: any,
    ) => {
      setFormState((prev) => {
        const newItems = (prev.itinerary[category] as any[]).map(
          (item, index) => {
            if (index === indexToUpdate) {
              return { ...item, [field]: value };
            }
            return item;
          },
        );

        return {
          ...prev,
          itinerary: {
            ...prev.itinerary,
            [category]: newItems,
          },
        };
      });
    },
    [],
  );

  const handleFlightFieldChange = useCallback(
    (flightIndex: number, field: keyof Flight, value: any) => {
      setFormState((prev) => {
        const updatedFlights = prev.itinerary.flights.map((flight, index) => {
          if (index === flightIndex) {
            return { ...flight, [field]: value };
          }
          return flight;
        });
        return {
          ...prev,
          itinerary: { ...prev.itinerary, flights: updatedFlights },
        };
      });
    },
    [],
  );

  const handleSectorChange = useCallback(
    (
      flightIndex: number,
      sectorIndex: number,
      field: keyof FlightSector,
      value: string,
    ) => {
      setFormState((prev) => ({
        ...prev,
        itinerary: {
          ...prev.itinerary,
          flights: prev.itinerary.flights.map((flight, index) => {
            if (index !== flightIndex) return flight;
            const sectors = (
              flight.sectors?.length
                ? flight.sectors
                : normalizeFlight(flight).sectors!
            ).map((sector, i) =>
              i === sectorIndex ? { ...sector, [field]: value } : sector,
            );
            return syncLegacyFlightFields(flight, sectors);
          }),
        },
      }));
    },
    [],
  );

  const addFlightSector = useCallback((flightIndex: number) => {
    setFormState((prev) => ({
      ...prev,
      itinerary: {
        ...prev.itinerary,
        flights: prev.itinerary.flights.map((flight, index) =>
          index === flightIndex
            ? syncLegacyFlightFields(flight, [
                ...(flight.sectors || []),
                createSector(),
              ])
            : flight,
        ),
      },
    }));
  }, []);

  const removeFlightSector = useCallback(
    (flightIndex: number, sectorIndex: number) => {
      setFormState((prev) => ({
        ...prev,
        itinerary: {
          ...prev.itinerary,
          flights: prev.itinerary.flights.map((flight, index) => {
            if (index !== flightIndex) return flight;
            const sectors = (flight.sectors || []).filter(
              (_, i) => i !== sectorIndex,
            );
            return syncLegacyFlightFields(
              flight,
              sectors.length ? sectors : [createSector()],
            );
          }),
        },
      }));
    },
    [],
  );

  const changeTripType = useCallback(
    (flightIndex: number, tripType: FlightTripType) => {
      setFormState((prev) => ({
        ...prev,
        itinerary: {
          ...prev.itinerary,
          flights: prev.itinerary.flights.map((flight, index) => {
            if (index !== flightIndex) return flight;
            let sectors = flight.sectors?.length
              ? [...flight.sectors]
              : normalizeFlight(flight).sectors!;
            if (tripType === "One Way") sectors = sectors.slice(0, 1);
            if (tripType === "Return" && sectors.length < 2)
              sectors.push(
                createSector({
                  departureAirport: sectors[0]?.arrivalAirport,
                  arrivalAirport: sectors[0]?.departureAirport,
                }),
              );
            return syncLegacyFlightFields({ ...flight, tripType }, sectors);
          }),
        },
      }));
    },
    [],
  );

  const removePassengerFromFlight = useCallback(
    (flightIndex: number, passengerId: string) => {
      setFormState((prev) => {
        const updatedFlights = prev.itinerary.flights.map((flight, index) => {
          if (index !== flightIndex) return flight;

          const newPassengerDetails = flight.passengerDetails.filter(
            (pd) => pd.passengerId !== passengerId,
          );

          return { ...flight, passengerDetails: newPassengerDetails };
        });
        return {
          ...prev,
          itinerary: { ...prev.itinerary, flights: updatedFlights },
        };
      });
    },
    [],
  );

  const handleAddPassengersToFlight = useCallback(
    (flightIndex: number, passengerIds: string[]) => {
      setFormState((prev) => {
        const flightToUpdate = prev.itinerary.flights[flightIndex];
        if (!flightToUpdate) return prev;

        const updatedFlights = [...prev.itinerary.flights];
        const targetFlight = { ...flightToUpdate };

        const existingPaxIds = new Set(
          targetFlight.passengerDetails.map((pd) => pd.passengerId),
        );

        const newPassengerDetailsToAdd: FlightPassengerDetail[] = passengerIds
          .filter((id) => !existingPaxIds.has(id))
          .map((paxId) => {
            const passenger = prev.passengers.find((p) => p.id === paxId);
            if (!passenger) return null;

            const netCost = targetFlight.isNetGrossSameForAll
              ? targetFlight.commonNetCost
              : 0;
            const grossBilled = targetFlight.isNetGrossSameForAll
              ? targetFlight.commonGrossBilled
              : 0;

            return {
              passengerId: paxId,
              passengerType: passenger.type,
              netCost,
              grossBilled,
            };
          })
          .filter((pd): pd is FlightPassengerDetail => pd !== null);

        targetFlight.passengerDetails = [
          ...targetFlight.passengerDetails,
          ...newPassengerDetailsToAdd,
        ];
        updatedFlights[flightIndex] = targetFlight;

        return {
          ...prev,
          itinerary: { ...prev.itinerary, flights: updatedFlights },
        };
      });
      setAddPaxToFlightIndex(null); // Close the modal
    },
    [],
  );

  const handleFlightPaxPriceChange = useCallback(
    (
      flightIndex: number,
      passengerId: string,
      field: "netCost" | "grossBilled",
      value: number,
    ) => {
      setFormState((prev) => {
        const updatedFlights = prev.itinerary.flights.map((flight, index) => {
          if (index !== flightIndex) return flight;

          const newPassengerDetails = flight.passengerDetails.map((pd) => {
            if (pd.passengerId === passengerId) {
              return { ...pd, [field]: value };
            }
            return pd;
          });
          return { ...flight, passengerDetails: newPassengerDetails };
        });
        return {
          ...prev,
          itinerary: { ...prev.itinerary, flights: updatedFlights },
        };
      });
    },
    [],
  );

  const handleFlightSameCostToggle = useCallback((flightIndex: number) => {
    setFormState((prev) => {
      const updatedFlights = prev.itinerary.flights.map((flight, index) => {
        if (index !== flightIndex) return flight;

        const newIsSame = !flight.isNetGrossSameForAll;
        let newPassengerDetails = [...flight.passengerDetails];

        if (newIsSame) {
          newPassengerDetails = newPassengerDetails.map((pd) => ({
            ...pd,
            netCost: flight.commonNetCost,
            grossBilled: flight.commonGrossBilled,
          }));
        }

        return {
          ...flight,
          isNetGrossSameForAll: newIsSame,
          passengerDetails: newPassengerDetails,
        };
      });

      return {
        ...prev,
        itinerary: { ...prev.itinerary, flights: updatedFlights },
      };
    });
  }, []);

  const handleFlightCommonCostChange = useCallback(
    (
      flightIndex: number,
      field: "commonNetCost" | "commonGrossBilled",
      value: number,
    ) => {
      setFormState((prev) => {
        const updatedFlights = prev.itinerary.flights.map((flight, index) => {
          if (index !== flightIndex) return flight;

          let newPassengerDetails = [...flight.passengerDetails];
          if (flight.isNetGrossSameForAll) {
            const detailField =
              field === "commonNetCost" ? "netCost" : "grossBilled";
            newPassengerDetails = newPassengerDetails.map((pd) => ({
              ...pd,
              [detailField]: value,
            }));
          }

          return {
            ...flight,
            [field]: value,
            passengerDetails: newPassengerDetails,
          };
        });

        return {
          ...prev,
          itinerary: { ...prev.itinerary, flights: updatedFlights },
        };
      });
    },
    [],
  );

  const handleHotelPaxToggle = useCallback(
    (hotelIndex: number, passengerId: string) => {
      setFormState((prev) => {
        const updatedHotels = prev.itinerary.hotels.map((hotel, index) => {
          if (index !== hotelIndex) return hotel;

          const newPaxRefs = hotel.paxRefs.includes(passengerId)
            ? hotel.paxRefs.filter((id) => id !== passengerId)
            : [...hotel.paxRefs, passengerId];

          return { ...hotel, paxRefs: newPaxRefs };
        });
        return {
          ...prev,
          itinerary: { ...prev.itinerary, hotels: updatedHotels },
        };
      });
    },
    [],
  );

  const addToArray = <K extends keyof Itinerary>(
    category: K,
    newItem: Itinerary[K][0],
  ) => {
    setFormState((prev) => ({
      ...prev,
      itinerary: {
        ...prev.itinerary,
        [category]: [...prev.itinerary[category], newItem],
      },
    }));
  };

  const removeFromArray = <K extends keyof Itinerary>(
    category: K,
    index: number,
  ) => {
    setFormState((prev) => ({
      ...prev,
      itinerary: {
        ...prev.itinerary,
        [category]: prev.itinerary[category].filter((_, i) => i !== index),
      },
    }));
  };

  const addPassenger = () =>
    setFormState((p) => ({
      ...p,
      passengers: [
        ...p.passengers,
        {
          id: `PAX-${Date.now()}`,
          fullName: "",
          type: PassengerType.Adult,
          gender: Gender.Male,
        },
      ],
    }));
  const removePassenger = (id: string) =>
    setFormState((p) => ({
      ...p,
      passengers: p.passengers.filter((px) => px.id !== id),
    }));
  const updatePassenger = (
    id: string,
    field: keyof Omit<Passenger, "id">,
    value: any,
  ) => {
    setFormState((p) => ({
      ...p,
      passengers: p.passengers.map((px) =>
        px.id === id ? { ...px, [field]: value } : px,
      ),
    }));
  };

  const financialSummary = useMemo(() => {
    const flightsTotal = formState.itinerary.flights.reduce(
      (flightAcc, flight) => {
        const passengerSubtotals = flight.passengerDetails.reduce(
          (paxAcc, paxDetail) => {
            return {
              netCost: paxAcc.netCost + (paxDetail.netCost || 0),
              grossBilled: paxAcc.grossBilled + (paxDetail.grossBilled || 0),
            };
          },
          { netCost: 0, grossBilled: 0 },
        );

        return {
          netCost: flightAcc.netCost + passengerSubtotals.netCost,
          grossBilled: flightAcc.grossBilled + passengerSubtotals.grossBilled,
        };
      },
      { netCost: 0, grossBilled: 0 },
    );

    const calculateSimpleTotals = (items: (Hotel | Excursion | Transfer)[]) =>
      items.reduce(
        (acc, item) => {
          return {
            netCost: acc.netCost + (item.netCost || 0),
            grossBilled: acc.grossBilled + (item.grossBilled || 0),
          };
        },
        { netCost: 0, grossBilled: 0 },
      );

    const hotelsTotal = calculateSimpleTotals(formState.itinerary.hotels);
    const excursionsTotal = calculateSimpleTotals(
      formState.itinerary.excursions,
    );
    const transfersTotal = calculateSimpleTotals(formState.itinerary.transfers);
    const serviceChargeTotals = {
      netCost: formState.itinerary.serviceCharge?.netCost || 0,
      grossBilled: formState.itinerary.serviceCharge?.grossBilled || 0,
    };

    // If invoices exist, use their subtotal (pre-GST) as the billed base;
    // otherwise, fall back to itinerary gross billed sums.
    const invoicesSubtotal =
      formState.invoices && formState.invoices.length > 0
        ? formState.invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0)
        : 0;

    const itineraryGrossTotal =
      flightsTotal.grossBilled +
      hotelsTotal.grossBilled +
      excursionsTotal.grossBilled +
      transfersTotal.grossBilled +
      serviceChargeTotals.grossBilled;
    const grandTotalGross =
      invoicesSubtotal > 0 ? invoicesSubtotal : itineraryGrossTotal;
    const grandTotalNet =
      flightsTotal.netCost +
      hotelsTotal.netCost +
      excursionsTotal.netCost +
      transfersTotal.netCost +
      serviceChargeTotals.netCost;
    const totalPaid = formState.payments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );

    // Calculate total GST from saved invoices
    const totalGST =
      formState.invoices?.reduce(
        (sum, invoice) => sum + (invoice.gstAmount || 0),
        0,
      ) || 0;

    // Calculate grand total including GST
    const grandTotalWithGST = grandTotalGross + totalGST;

    return {
      flights: {
        netCost: flightsTotal.netCost,
        grossBilled: flightsTotal.grossBilled,
        profit: flightsTotal.grossBilled - flightsTotal.netCost,
      },
      hotels: {
        netCost: hotelsTotal.netCost,
        grossBilled: hotelsTotal.grossBilled,
        profit: hotelsTotal.grossBilled - hotelsTotal.netCost,
      },
      excursions: {
        netCost: excursionsTotal.netCost,
        grossBilled: excursionsTotal.grossBilled,
        profit: excursionsTotal.grossBilled - excursionsTotal.netCost,
      },
      transfers: {
        netCost: transfersTotal.netCost,
        grossBilled: transfersTotal.grossBilled,
        profit: transfersTotal.grossBilled - transfersTotal.netCost,
      },
      serviceCharge: {
        netCost: serviceChargeTotals.netCost,
        grossBilled: serviceChargeTotals.grossBilled,
        profit: serviceChargeTotals.grossBilled - serviceChargeTotals.netCost,
      },
      grandTotalGross,
      grandTotalNet,
      grandTotalWithGST,
      totalGST,
      grandTotalProfit: grandTotalGross - grandTotalNet,
      amountPaid: totalPaid,
      balanceDue: grandTotalWithGST - totalPaid,
    };
  }, [formState.itinerary, formState.payments, formState.invoices]);

  const addPayment = async (payment: Omit<Payment, "id">) => {
    const newPayment: Payment = { ...payment, id: `PAY-${Date.now()}` };
    const comment: Comment = {
      id: `SYS-PAY-${Date.now()}`,
      text: `🔒 Auto-log: Payment of ${formatCurrency(payment.amount)} recorded. Type: ${payment.type}, Date: ${formatDate(payment.date)}.`,
      timestamp: new Date().toISOString(),
      author: "System",
      isSystem: true,
    };
    const updatedFormState = {
      ...formState,
      payments: [newPayment, ...formState.payments],
      comments: [comment, ...formState.comments],
    };
    setFormState(updatedFormState);

    // Auto-save the docket to persist the payment and comment immediately
    if (docket?.id) {
      try {
        await onSave(updatedFormState, docket.id);
        // Show a brief success indicator for the auto-save
        setShowSaveSuccess(true);
        if (notificationTimer.current) clearTimeout(notificationTimer.current);
        notificationTimer.current = setTimeout(() => {
          setShowSaveSuccess(false);
        }, 2000);
      } catch (error) {
        console.error("Failed to auto-save payment:", error);
        // Optionally show an error message to the user
        alert("Failed to save payment. Please try again.");
      }
    }
  };

  const addComment = async (text: string) => {
    const newComment: Comment = {
      id: `COM-${Date.now()}`,
      text,
      timestamp: new Date().toISOString(),
      author: currentUser?.email,
    };
    const updatedFormState = {
      ...formState,
      comments: [newComment, ...formState.comments],
    };
    setFormState(updatedFormState);

    // Auto-save the docket to persist the comment immediately
    if (docket?.id) {
      try {
        await onSave(updatedFormState, docket.id);
        // Show a brief success indicator for the auto-save
        setShowSaveSuccess(true);
        if (notificationTimer.current) clearTimeout(notificationTimer.current);
        notificationTimer.current = setTimeout(() => {
          setShowSaveSuccess(false);
        }, 2000);
      } catch (error) {
        console.error("Failed to auto-save comment:", error);
        // Optionally show an error message to the user
        alert("Failed to save comment. Please try again.");
      }
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    linkedItemId?: string,
    linkedItemType?: "flight" | "hotel" | "excursion" | "transfer",
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const base64 = await toBase64(file);
      const uploadedFile: UploadedFile = {
        id: `FILE-${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        content: base64,
        linkedItemId,
        linkedItemType,
      };
      setFormState((p) => ({ ...p, files: [...p.files, uploadedFile] }));
      e.target.value = ""; // Reset file input to allow re-uploading the same file
    }
  };

  const passengerTypeFromAI = (value?: string) =>
    value?.toLowerCase().startsWith("inf")
      ? PassengerType.Infant
      : value?.toLowerCase().startsWith("child")
        ? PassengerType.Child
        : PassengerType.Adult;
  const genderFromAI = (value?: string) =>
    value?.toLowerCase().startsWith("f")
      ? Gender.Female
      : value?.toLowerCase().startsWith("m")
        ? Gender.Male
        : Gender.Other;

  // Extract every passenger and sector, then retain the source ticket as a linked file.
  const handleFlightTicketUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    itemIndex: number,
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setDocumentLoading(true);
    console.log("Uploading in tab: flight", "Updating flight details...");

    try {
      const base64 = await toBase64(file);
      const flightId = formState.itinerary.flights[itemIndex]?.id;
      const uploadedFile: UploadedFile = {
        id: `FILE-${Date.now()}`,
        name: file.name,
        type: file.type || "application/pdf",
        size: file.size,
        content: base64,
        linkedItemId: flightId,
        linkedItemType: "flight",
      };
      // Preserve the source document even when the ticket cannot be read automatically.
      setFormState((prev) => ({ ...prev, files: [...prev.files, uploadedFile] }));
      const { data: extractedData, reason } = await extractDocumentData({
        base64,
        mimeType: file.type,
        parse: parseETicketText,
      });

      if (extractedData && extractedData.sectors?.length) {
        setFormState((prev) => {
          const extractedPassengers = extractedData.passengers || [];
          const existingNames = new Set(
            prev.passengers.map((p) => p.fullName.toLowerCase().trim()),
          );
          const newUniquePassengers: Passenger[] = extractedPassengers
            .filter(
              (p: { fullName: string }) =>
                p.fullName &&
                !existingNames.has(p.fullName.toLowerCase().trim()),
            )
            .map(
              (p: {
                fullName: string;
                passengerType?: string;
                gender?: string;
              }): Passenger => ({
                id: `PAX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                fullName: p.fullName.trim(),
                type: passengerTypeFromAI(p.passengerType),
                gender: genderFromAI(p.gender),
              }),
            );
          const updatedGlobalPassengers = [
            ...prev.passengers,
            ...newUniquePassengers,
          ];
          const extractedPassengerNames = new Set(
            extractedPassengers.map((p: { fullName: string }) =>
              p.fullName.toLowerCase().trim(),
            ),
          );
          const passengerIdsForThisFlight = updatedGlobalPassengers
            .filter((p) =>
              extractedPassengerNames.has(p.fullName.toLowerCase().trim()),
            )
            .map((p) => p.id);
          const newPassengerDetailsForFlight: FlightPassengerDetail[] =
            passengerIdsForThisFlight.map((paxId) => ({
              passengerId: paxId,
              passengerType: updatedGlobalPassengers.find(
                (p) => p.id === paxId,
              )!.type,
              netCost: 0,
              grossBilled: 0,
            }));

          const updatedFlights = prev.itinerary.flights.map((flight, index) => {
            if (index === itemIndex) {
              const sectors = extractedData.sectors.map(
                (sector: Partial<FlightSector>) => createSector(sector),
              );
              const detectedType: FlightTripType = [
                "One Way",
                "Return",
                "Multi-City",
              ].includes(extractedData.tripType)
                ? extractedData.tripType
                : sectors.length === 1
                  ? "One Way"
                  : "Multi-City";
              const updatedFlight = syncLegacyFlightFields(
                {
                  ...flight,
                  pnr: extractedData.pnr || flight.pnr,
                  bookingId: extractedData.bookingId || flight.bookingId,
                  tripType: detectedType,
                  passengerDetails: newPassengerDetailsForFlight,
                },
                sectors,
              );
              if (updatedFlight.isNetGrossSameForAll) {
                updatedFlight.passengerDetails =
                  updatedFlight.passengerDetails.map((pd) => ({
                    ...pd,
                    netCost: updatedFlight.commonNetCost,
                    grossBilled: updatedFlight.commonGrossBilled,
                  }));
              }
              return updatedFlight;
            }
            return flight;
          });

          return {
            ...prev,
            passengers: updatedGlobalPassengers,
            itinerary: { ...prev.itinerary, flights: updatedFlights },
          };
        });
      } else {
        alert(
          explainExtractionFailure(reason),
        );
      }
    } catch (error) {
      console.error("Ticket parsing error in Flight tab:", error);
      alert("The PDF has been attached, but its details could not be read. You can enter the flight manually and save the docket.");
    } finally {
      setDocumentLoading(false);
      e.target.value = "";
    }
  };

  // Dedicated handler for processing hotel vouchers. It only updates hotel-related state.
  const handleHotelVoucherUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setDocumentLoading(true);
    console.log("Uploading in tab: hotel", "Updating hotel details...");

    try {
      const base64 = await toBase64(file);
      const uploadedFile: UploadedFile = {
        id: `FILE-${Date.now()}`,
        name: file.name,
        type: file.type || "application/pdf",
        size: file.size,
        content: base64,
      };
      setFormState((prev) => ({ ...prev, files: [...prev.files, uploadedFile] }));
      const { data: extractedData, reason } = await extractDocumentData({
        base64,
        mimeType: file.type,
        parse: parseHotelVoucherText,
      });

      if (extractedData && extractedData.hotel) {
        setFormState((prev) => {
          const { passengers: extractedPassengers, hotel: extractedHotel } =
            extractedData;
          const existingNames = new Set(
            prev.passengers.map((p) => p.fullName.toLowerCase().trim()),
          );
          const newUniquePassengers: Passenger[] = (extractedPassengers || [])
            .filter(
              (p: { fullName: string }) =>
                p.fullName &&
                !existingNames.has(p.fullName.toLowerCase().trim()),
            )
            .map(
              (p: { fullName: string }): Passenger => ({
                id: `PAX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                fullName: p.fullName.trim(),
                type: PassengerType.Adult,
                gender: Gender.Male,
              }),
            );
          const updatedGlobalPassengers = [
            ...prev.passengers,
            ...newUniquePassengers,
          ];
          const extractedPassengerNames = new Set(
            (extractedPassengers || []).map((p: { fullName: string }) =>
              p.fullName.toLowerCase().trim(),
            ),
          );
          const passengerIdsForThisHotel = updatedGlobalPassengers
            .filter((p) =>
              extractedPassengerNames.has(p.fullName.toLowerCase().trim()),
            )
            .map((p) => p.id);

          const newHotelId = `HO-${Date.now()}`;
          const newHotel: Hotel = {
            id: newHotelId,
            netCost: 0,
            grossBilled: 0,
            supplier: null,
            numberOfRooms: 1,
            ...extractedHotel,
            paxRefs: passengerIdsForThisHotel,
          };

          return {
            ...prev,
            passengers: updatedGlobalPassengers,
            itinerary: {
              ...prev.itinerary,
              hotels: [...prev.itinerary.hotels, newHotel],
            },
            files: prev.files.map((savedFile) => savedFile.id === uploadedFile.id ? { ...savedFile, linkedItemId: newHotelId, linkedItemType: "hotel" } : savedFile),
          };
        });
      } else {
        console.warn("Voucher layout not recognised:", reason);
        alert(explainExtractionFailure(reason));
      }
    } catch (error) {
      console.error("Voucher parsing error in Hotel tab:", error);
      alert(
        "The voucher has been attached, but its details could not be read. You can enter the hotel manually and save the docket.",
      );
    } finally {
      setDocumentLoading(false);
      e.target.value = "";
    }
  };

  const handleSaveSupplier = () => {
    if (newSupplier.name) {
      saveSupplier({ ...newSupplier });
      setSupplierModalOpen(false);
      setNewSupplier({ name: "", contactPerson: "", contactNumber: "" });
    }
  };

  const handleSaveInvoice = (invoice: Invoice) => {
    setFormState((p) => {
      const existingInvoices = p.invoices || [];

      // Check if this invoice already exists (by ID)
      const existingIndex = existingInvoices.findIndex(
        (inv) => inv.id === invoice.id,
      );

      let updatedInvoices;
      if (existingIndex >= 0) {
        // Replace the existing invoice
        updatedInvoices = [...existingInvoices];
        updatedInvoices[existingIndex] = invoice;
      } else {
        // Add new invoice
        updatedInvoices = [...existingInvoices, invoice];
      }

      return {
        ...p,
        invoices: updatedInvoices,
      };
    });
  };

  const handleSaveClick = async () => {
    let stateToSave = { ...formState };
    const newSystemLogs: Comment[] = [];
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const rupee = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

    const getFlightTotals = (flight: Flight) => {
      return flight.passengerDetails.reduce(
        (acc, pd) => {
          acc.netCost += pd.netCost || 0;
          acc.grossBilled += pd.grossBilled || 0;
          return acc;
        },
        { netCost: 0, grossBilled: 0 },
      );
    };

    // Build per-type totals from current form state
    const totals = {
      flights: stateToSave.itinerary.flights.reduce(
        (acc, f) => {
          const t = getFlightTotals(f);
          acc.netCost += t.netCost;
          acc.grossBilled += t.grossBilled;
          return acc;
        },
        { netCost: 0, grossBilled: 0 },
      ),
      hotels: stateToSave.itinerary.hotels.reduce(
        (acc, h) => ({
          netCost: acc.netCost + (h.netCost || 0),
          grossBilled: acc.grossBilled + (h.grossBilled || 0),
        }),
        { netCost: 0, grossBilled: 0 },
      ),
      transfers: stateToSave.itinerary.transfers.reduce(
        (acc, t) => ({
          netCost: acc.netCost + (t.netCost || 0),
          grossBilled: acc.grossBilled + (t.grossBilled || 0),
        }),
        { netCost: 0, grossBilled: 0 },
      ),
      excursions: stateToSave.itinerary.excursions.reduce(
        (acc, e) => ({
          netCost: acc.netCost + (e.netCost || 0),
          grossBilled: acc.grossBilled + (e.grossBilled || 0),
        }),
        { netCost: 0, grossBilled: 0 },
      ),
    };

    const findMostRecentSystemForType = (
      label: "Flight" | "Hotel" | "Transfers" | "Excursions",
    ) => {
      return (stateToSave.comments || []).find(
        (c) =>
          c.isSystem &&
          typeof c.text === "string" &&
          c.text.trim().endsWith(`– ${label}`),
      );
    };

    const pushTypeLogIfAny = (
      label: "Flight" | "Hotel" | "Transfers" | "Excursions",
      net: number,
      gross: number,
    ) => {
      if ((net || 0) > 0 || (gross || 0) > 0) {
        const nextText = `${ts} – Net Cost: ${rupee(net)}, Gross Cost: ${rupee(gross)} – ${label}`;
        const recent = findMostRecentSystemForType(label);
        if (recent && recent.isSystem && recent.text === nextText) {
          return; // skip identical consecutive duplicate
        }
        newSystemLogs.push({
          id: `SYS-COST-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: nextText,
          timestamp: now.toISOString(),
          author: "System",
          isSystem: true,
        });
      }
    };

    // Log costs only when creating a new docket OR when status changes to Confirmed
    const isNew = !docket;
    const statusJustConfirmed =
      !!docket &&
      docket.status !== BookingStatus.Confirmed &&
      stateToSave.status === BookingStatus.Confirmed;
    if (isNew || statusJustConfirmed) {
      pushTypeLogIfAny(
        "Flight",
        totals.flights.netCost,
        totals.flights.grossBilled,
      );
      pushTypeLogIfAny(
        "Hotel",
        totals.hotels.netCost,
        totals.hotels.grossBilled,
      );
      pushTypeLogIfAny(
        "Transfers",
        totals.transfers.netCost,
        totals.transfers.grossBilled,
      );
      pushTypeLogIfAny(
        "Excursions",
        totals.excursions.netCost,
        totals.excursions.grossBilled,
      );
    }

    // If there are new logs, add them to the state that will be saved (prepend to keep latest on top)
    if (newSystemLogs.length > 0) {
      stateToSave = {
        ...stateToSave,
        comments: [...newSystemLogs.reverse(), ...stateToSave.comments],
      };
    }

    await onSave(stateToSave, docket?.id);

    // Show success message logic
    setShowSaveSuccess(true);
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    notificationTimer.current = setTimeout(() => {
      setShowSaveSuccess(false);
    }, 3000);
  };

  const handleDeleteClick = () => {
    if (docket?.id && deleteReason) onDelete(docket.id, deleteReason);
    setDeleteModalOpen(false);
  };

  const getLinkedItemDescription = useCallback(
    (file: UploadedFile): string | null => {
      if (!file.linkedItemId || !file.linkedItemType) return null;

      const findItem = (items: any[], id: string) =>
        items.find((item) => item.id === id);

      switch (file.linkedItemType) {
        case "flight":
          const flight = findItem(
            formState.itinerary.flights,
            file.linkedItemId,
          );
          return flight
            ? `Flight: ${flight.airline} (${flight.departureAirport}-${flight.arrivalAirport})`
            : "Linked Flight";
        case "hotel":
          const hotel = findItem(formState.itinerary.hotels, file.linkedItemId);
          return hotel ? `Hotel: ${hotel.name}` : "Linked Hotel";
        default:
          return null;
      }
    },
    [formState.itinerary],
  );

  const tabs = [
    { id: "details", label: "Client Details", icon: Icons.user },
    { id: "itinerary", label: "Itinerary", icon: Icons.plane },
    { id: "payments", label: "Payments", icon: Icons.payment },
    { id: "invoices", label: "Invoices", icon: Icons.invoice },
    { id: "files", label: "Files & Comments", icon: Icons.file },
  ];
  const summaryItems = {
    flights: financialSummary.flights,
    hotels: financialSummary.hotels,
    excursions: financialSummary.excursions,
    transfers: financialSummary.transfers,
    "service charge": financialSummary.serviceCharge,
  };

  const SupplierSelectControl: React.FC<{
    value: string | undefined;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  }> = ({ value, onChange }) => (
    <div className="flex items-end gap-2">
      <FormSelect
        label="Supplier"
        value={value || ""}
        onChange={onChange}
        disabled={isReadOnly}
      >
        <option value="">None</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </FormSelect>
      <button
        type="button"
        onClick={() => setSupplierModalOpen(true)}
        className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 h-10"
        disabled={isReadOnly}
      >
        {Icons.plus}
      </button>
    </div>
  );

  // New: Handler to upload an e-ticket from the Passengers tab.
  // This will auto-fill the passenger list and create a new flight from the ticket details.
  const handlePassengerTabTicketUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setDocumentLoading(true);
    try {
      const base64 = await toBase64(file);
      const uploadedFile: UploadedFile = {
        id: `FILE-${Date.now()}`,
        name: file.name,
        type: file.type || "application/pdf",
        size: file.size,
        content: base64,
      };
      setFormState((prev) => ({ ...prev, files: [...prev.files, uploadedFile] }));
      const { data: extractedData, reason } = await extractDocumentData({
        base64,
        mimeType: file.type,
        parse: parseETicketText,
      });
      if (extractedData && extractedData.sectors?.length) {
        setFormState((prev) => {
          const extractedPassengers = extractedData.passengers || [];
          // Merge passengers
          const existingNames = new Set(
            prev.passengers.map((p) => p.fullName.toLowerCase().trim()),
          );
          const newUniquePassengers: Passenger[] = (extractedPassengers || [])
            .filter(
              (p: { fullName: string }) =>
                p.fullName &&
                !existingNames.has(p.fullName.toLowerCase().trim()),
            )
            .map(
              (p: {
                fullName: string;
                passengerType?: string;
                gender?: string;
              }): Passenger => ({
                id: `PAX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                fullName: p.fullName.trim(),
                type: passengerTypeFromAI(p.passengerType),
                gender: genderFromAI(p.gender),
              }),
            );
          const updatedGlobalPassengers = [
            ...prev.passengers,
            ...newUniquePassengers,
          ];
          const extractedPassengerNames = new Set(
            (extractedPassengers || []).map((p: { fullName: string }) =>
              p.fullName.toLowerCase().trim(),
            ),
          );
          const passengerIdsForThisFlight = updatedGlobalPassengers
            .filter((p) =>
              extractedPassengerNames.has(p.fullName.toLowerCase().trim()),
            )
            .map((p) => p.id);

          // Create a new flight entry populated from the ticket
          const newFlightId = `FL-${Date.now()}`;
          const sectors = extractedData.sectors.map(
            (sector: Partial<FlightSector>) => createSector(sector),
          );
          const detectedType: FlightTripType = [
            "One Way",
            "Return",
            "Multi-City",
          ].includes(extractedData.tripType)
            ? extractedData.tripType
            : sectors.length === 1
              ? "One Way"
              : "Multi-City";
          const newFlight: Flight = syncLegacyFlightFields(
            {
              id: newFlightId,
              airline: "",
              pnr: extractedData.pnr || "",
              bookingId: extractedData.bookingId || "",
              flightNumber: "",
              departureDate: "",
              departureTime: "",
              arrivalDate: "",
              arrivalTime: "",
              departureAirport: "",
              arrivalAirport: "",
              tripType: detectedType,
              supplier: null,
              isNetGrossSameForAll: true,
              commonNetCost: 0,
              commonGrossBilled: 0,
              passengerDetails: passengerIdsForThisFlight.map((paxId) => ({
                passengerId: paxId,
                passengerType: updatedGlobalPassengers.find(
                  (p) => p.id === paxId,
                )!.type,
                netCost: 0,
                grossBilled: 0,
              })),
            },
            sectors,
          );

          return {
            ...prev,
            passengers: updatedGlobalPassengers,
            itinerary: {
              ...prev.itinerary,
              flights: [...prev.itinerary.flights, newFlight],
            },
            files: prev.files.map((savedFile) => savedFile.id === uploadedFile.id ? { ...savedFile, linkedItemId: newFlightId, linkedItemType: "flight" } : savedFile),
          };
        });
      } else {
        console.warn("Ticket layout not recognised:", reason);
        alert(explainExtractionFailure(reason));
      }
    } catch (error) {
      console.error("Ticket parsing error in Passengers tab:", error);
      alert("The PDF has been attached, but its details could not be read. You can enter the flight manually and save the docket.");
    } finally {
      setDocumentLoading(false);
      e.target.value = "";
    }
  };

  return (
    <>
      {showSaveSuccess && (
        <div
          className="fixed top-24 right-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50 transition-opacity duration-300"
          role="alert"
        >
          <strong className="font-bold">Success!</strong>
          <span className="block sm:inline ml-2">
            Docket saved successfully.
          </span>
        </div>
      )}
      <div className="flex flex-col lg:flex-row h-full bg-slate-100">
        <div className="flex-grow lg:w-2/3 p-4 sm:p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              {docket
                ? `Edit Docket: ${docket.docketNo || docket.id}`
                : "Create New Docket"}
              {isReadOnly && (
                <span className="text-amber-500" title="Read-only mode">
                  🔒
                </span>
              )}
            </h1>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>

          {isReadOnly && (
            <div
              className="bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 mb-4 rounded-r-lg"
              role="alert"
            >
              <p className="font-bold">Read-Only Mode</p>
              <p>
                This docket was created by another user. You can view details
                and add comments, but you cannot make any other changes.
              </p>
            </div>
          )}

          <div className="border-b border-slate-200 mb-6">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${activeTab === tab.id ? "border-brand-primary text-brand-primary" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {documentLoading && (
            <div className="absolute inset-0 bg-white/70 z-30 flex flex-col justify-center items-center">
              <Spinner />
              <p className="mt-4 text-slate-600 font-semibold">
                Reading your document...
              </p>
            </div>
          )}

          <div className="space-y-6">
            {activeTab === "details" && (
              <Section title="Client Details" icon={Icons.user}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormInput
                    label="Client Name"
                    value={formState.client.name}
                    onChange={(e) => handleClientChange("name", e.target.value)}
                    disabled={isReadOnly}
                  />
                  <FormInput
                    label="Contact Info (Email/Phone)"
                    value={formState.client.contactInfo}
                    onChange={(e) =>
                      handleClientChange("contactInfo", e.target.value)
                    }
                    disabled={isReadOnly}
                  />
                  <FormSelect
                    label="Lead Source"
                    value={formState.client.leadSource}
                    onChange={(e) =>
                      handleClientChange(
                        "leadSource",
                        e.target.value as LeadSource,
                      )
                    }
                    disabled={isReadOnly}
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect
                    label="Assigned Agent"
                    value={formState.agentId || ""}
                    onChange={(e) =>
                      setFormState((p) => ({
                        ...p,
                        agentId: e.target.value || null,
                      }))
                    }
                    disabled={isReadOnly}
                  >
                    <option value="">-- Unassigned --</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </FormSelect>
                </div>
              </Section>
            )}

            {activeTab === "itinerary" && (
              <>
                <div
                  className={`${formState.status === BookingStatus.Confirmed ? "confirmed-mode" : "editable-mode"}`}
                >
                  <Section
                    title="Passengers"
                    icon={Icons.user}
                    bgClass="bg-white"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <button
                        onClick={addPassenger}
                        disabled={isReadOnly}
                        className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        {Icons.plus} Add Passenger
                      </button>
                      <label
                        htmlFor="pax-ticket-upload"
                        className={`flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-purple-200 ${isReadOnly ? "cursor-not-allowed bg-slate-200 text-slate-500" : "cursor-pointer"}`}
                      >
                        {Icons.ai} Upload E‑Ticket & Autofill
                      </label>
                      <input
                        id="pax-ticket-upload"
                        type="file"
                        className="hidden"
                        onChange={handlePassengerTabTicketUpload}
                        accept="image/*,application/pdf"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div className="space-y-3">
                      {formState.passengers.map((pax, index) => (
                        <details
                          key={pax.id}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <summary className="flex justify-between items-center cursor-pointer list-none">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">
                                {Icons.chevronDown}
                              </span>
                              <span className="font-medium text-slate-800">
                                {pax.fullName || `Passenger ${index + 1}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FormSelect
                                label=""
                                value={pax.type}
                                onChange={(e) =>
                                  updatePassenger(
                                    pax.id,
                                    "type",
                                    e.target.value as PassengerType,
                                  )
                                }
                                disabled={isReadOnly}
                                className="w-24 text-sm !p-1.5"
                              >
                                {Object.values(PassengerType).map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </FormSelect>
                              <FormSelect
                                label=""
                                value={pax.gender}
                                onChange={(e) =>
                                  updatePassenger(
                                    pax.id,
                                    "gender",
                                    e.target.value as Gender,
                                  )
                                }
                                disabled={isReadOnly}
                                className="w-24 text-sm !p-1.5"
                              >
                                {Object.values(Gender).map((g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                ))}
                              </FormSelect>
                              <button
                                onClick={() => removePassenger(pax.id)}
                                disabled={isReadOnly}
                                className="p-2 text-red-500 hover:bg-red-100 rounded-md disabled:text-slate-400 disabled:hover:bg-transparent"
                              >
                                {Icons.trash}
                              </button>
                            </div>
                          </summary>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                            <FormInput
                              label="Full Name"
                              value={pax.fullName}
                              onChange={(e) =>
                                updatePassenger(
                                  pax.id,
                                  "fullName",
                                  e.target.value,
                                )
                              }
                              placeholder={`Passenger ${index + 1} Full Name`}
                              disabled={isReadOnly}
                            />
                            <FormInput
                              label="Email"
                              type="email"
                              value={pax.email || ""}
                              onChange={(e) =>
                                updatePassenger(pax.id, "email", e.target.value)
                              }
                              placeholder="Email Address"
                              disabled={isReadOnly}
                            />
                            <FormInput
                              label="Phone"
                              value={pax.phone || ""}
                              onChange={(e) =>
                                updatePassenger(pax.id, "phone", e.target.value)
                              }
                              placeholder="Phone Number"
                              disabled={isReadOnly}
                            />
                            <FormInput
                              label="GSTIN (Optional)"
                              value={pax.gstin || ""}
                              onChange={(e) =>
                                updatePassenger(pax.id, "gstin", e.target.value)
                              }
                              placeholder="GST Identification Number"
                              disabled={isReadOnly}
                            />
                            <FormTextarea
                              containerClassName="md:col-span-2"
                              label="Address"
                              value={pax.address || ""}
                              onChange={(e) =>
                                updatePassenger(
                                  pax.id,
                                  "address",
                                  e.target.value,
                                )
                              }
                              placeholder="Billing Address"
                              rows={2}
                              disabled={isReadOnly}
                            />
                          </div>
                        </details>
                      ))}
                    </div>
                  </Section>

                  <Section
                    title="Flights"
                    icon={Icons.plane}
                    bgClass="bg-[#f0f8ff]"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() =>
                          addToArray(
                            "flights",
                            syncLegacyFlightFields(
                              {
                                id: `FL-${Date.now()}`,
                                airline: "",
                                pnr: "",
                                bookingId: "",
                                flightNumber: "",
                                departureDate: "",
                                departureTime: "",
                                arrivalDate: "",
                                arrivalTime: "",
                                departureAirport: "",
                                arrivalAirport: "",
                                supplier: null,
                                isNetGrossSameForAll: false,
                                commonNetCost: 0,
                                commonGrossBilled: 0,
                                passengerDetails: [],
                                tripType: "One Way",
                              },
                              [createSector()],
                            ),
                          )
                        }
                        disabled={isReadOnly}
                        className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        {Icons.plus} Add Flight Booking
                      </button>
                    </div>
                    {formState.itinerary.flights.map((flight, index) => (
                      <div
                        key={flight.id}
                        className="p-4 border rounded-md mb-4 bg-slate-50"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                          <FormSelect
                            label="Journey Type"
                            value={flight.tripType || "One Way"}
                            onChange={(e) =>
                              changeTripType(
                                index,
                                e.target.value as FlightTripType,
                              )
                            }
                            disabled={isReadOnly}
                          >
                            <option>One Way</option>
                            <option>Return</option>
                            <option>Multi-City</option>
                          </FormSelect>
                          <FormInput
                            label="PNR"
                            value={flight.pnr}
                            onChange={(e) =>
                              handleFlightFieldChange(
                                index,
                                "pnr",
                                e.target.value,
                              )
                            }
                            disabled={isReadOnly}
                          />
                          <FormInput
                            label="Booking ID / Ref"
                            value={flight.bookingId || ""}
                            onChange={(e) =>
                              handleFlightFieldChange(
                                index,
                                "bookingId",
                                e.target.value,
                              )
                            }
                            disabled={isReadOnly}
                          />
                          <div>
                            <SupplierSelectControl
                              value={flight.supplier?.id}
                              onChange={(e) =>
                                handleFlightFieldChange(
                                  index,
                                  "supplier",
                                  suppliers.find(
                                    (s) => s.id === e.target.value,
                                  ) || null,
                                )
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-3 mb-4">
                          {(
                            flight.sectors || normalizeFlight(flight).sectors!
                          ).map((sector, sectorIndex) => (
                            <div
                              key={sector.id}
                              className="rounded-lg border border-blue-200 bg-white p-3"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-sm text-slate-700">
                                  {flight.tripType === "Return"
                                    ? sectorIndex === 0
                                      ? "Outbound"
                                      : sectorIndex === 1
                                        ? "Return"
                                        : `Sector ${sectorIndex + 1}`
                                    : `Sector ${sectorIndex + 1}`}
                                </h4>
                                {(flight.sectors?.length || 1) > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeFlightSector(index, sectorIndex)
                                    }
                                    disabled={isReadOnly}
                                    className="text-xs font-semibold text-red-600 disabled:text-slate-400"
                                  >
                                    Remove sector
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <FormInput
                                  label="Airline"
                                  value={sector.airline}
                                  onChange={(e) =>
                                    handleSectorChange(
                                      index,
                                      sectorIndex,
                                      "airline",
                                      e.target.value,
                                    )
                                  }
                                  disabled={isReadOnly}
                                />
                                <FormInput
                                  label="Flight No."
                                  value={sector.flightNumber || ""}
                                  onChange={(e) =>
                                    handleSectorChange(
                                      index,
                                      sectorIndex,
                                      "flightNumber",
                                      e.target.value,
                                    )
                                  }
                                  disabled={isReadOnly}
                                />
                                <FormInput
                                  label="From Airport"
                                  value={sector.departureAirport}
                                  onChange={(e) =>
                                    handleSectorChange(
                                      index,
                                      sectorIndex,
                                      "departureAirport",
                                      e.target.value,
                                    )
                                  }
                                  disabled={isReadOnly}
                                />
                                <FormInput
                                  label="To Airport"
                                  value={sector.arrivalAirport}
                                  onChange={(e) =>
                                    handleSectorChange(
                                      index,
                                      sectorIndex,
                                      "arrivalAirport",
                                      e.target.value,
                                    )
                                  }
                                  disabled={isReadOnly}
                                />
                                <FormInput
                                  label="Departure Date"
                                  type="date"
                                  value={sector.departureDate}
                                  onChange={(e) =>
                                    handleSectorChange(
                                      index,
                                      sectorIndex,
                                      "departureDate",
                                      e.target.value,
                                    )
                                  }
                                  icon={Icons.calendar}
                                  disabled={isReadOnly}
                                />
                                <FormInput
                                  label="Departure Time"
                                  type="time"
                                  value={sector.departureTime || ""}
                                  onChange={(e) =>
                                    handleSectorChange(
                                      index,
                                      sectorIndex,
                                      "departureTime",
                                      e.target.value,
                                    )
                                  }
                                  disabled={isReadOnly}
                                />
                                <FormInput
                                  label="Arrival Date"
                                  type="date"
                                  value={sector.arrivalDate || ""}
                                  onChange={(e) =>
                                    handleSectorChange(
                                      index,
                                      sectorIndex,
                                      "arrivalDate",
                                      e.target.value,
                                    )
                                  }
                                  icon={Icons.calendar}
                                  disabled={isReadOnly}
                                />
                                <FormInput
                                  label="Arrival Time"
                                  type="time"
                                  value={sector.arrivalTime || ""}
                                  onChange={(e) =>
                                    handleSectorChange(
                                      index,
                                      sectorIndex,
                                      "arrivalTime",
                                      e.target.value,
                                    )
                                  }
                                  disabled={isReadOnly}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        {flight.tripType === "Multi-City" && (
                          <button
                            type="button"
                            onClick={() => addFlightSector(index)}
                            disabled={isReadOnly}
                            className="mb-4 flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-2 rounded-md text-sm font-semibold hover:bg-blue-200 disabled:bg-slate-200 disabled:text-slate-500"
                          >
                            {Icons.plus} Add Sector
                          </button>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          <label
                            htmlFor={`flight-upload-${index}`}
                            className={`flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-2 rounded-md text-sm font-semibold hover:bg-purple-200 ${isReadOnly ? "cursor-not-allowed bg-slate-200 text-slate-500" : "cursor-pointer"}`}
                          >
                            {Icons.ai} Upload & Autofill Ticket
                          </label>
                          <input
                            id={`flight-upload-${index}`}
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFlightTicketUpload(e, index)}
                            accept="image/*,application/pdf"
                            disabled={isReadOnly}
                          />
                          <button
                            onClick={() => removeFromArray("flights", index)}
                            className="p-2 text-red-500 hover:bg-red-100 rounded-md h-10 disabled:text-slate-400 disabled:hover:bg-transparent"
                            disabled={isReadOnly}
                          >
                            {Icons.trash}
                          </button>
                        </div>
                        <div className="p-3 border-t mt-4">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold">
                              Passengers & Pricing
                            </h4>
                            <button
                              type="button"
                              onClick={() => setAddPaxToFlightIndex(index)}
                              className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 disabled:bg-slate-200 disabled:text-slate-500"
                              disabled={isReadOnly}
                            >
                              {Icons.plus} Add Passenger Manually
                            </button>
                          </div>
                          <div className="flex items-center gap-4 mb-3 p-2 bg-slate-200 rounded-md">
                            <label className="flex items-center gap-2 text-sm font-medium">
                              <input
                                type="checkbox"
                                checked={flight.isNetGrossSameForAll}
                                onChange={() =>
                                  handleFlightSameCostToggle(index)
                                }
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                disabled={isReadOnly}
                              />
                              Net/Gross is same for all
                            </label>
                            {flight.isNetGrossSameForAll && (
                              <>
                                <FormInput
                                  label="Common Net"
                                  type="number"
                                  value={flight.commonNetCost || ""}
                                  onChange={(e) =>
                                    handleFlightCommonCostChange(
                                      index,
                                      "commonNetCost",
                                      +e.target.value,
                                    )
                                  }
                                  disabled={isReadOnly}
                                />
                                <FormInput
                                  label="Common Gross"
                                  type="number"
                                  value={flight.commonGrossBilled || ""}
                                  onChange={(e) =>
                                    handleFlightCommonCostChange(
                                      index,
                                      "commonGrossBilled",
                                      +e.target.value,
                                    )
                                  }
                                  disabled={isReadOnly}
                                />
                              </>
                            )}
                          </div>
                          <div className="space-y-2">
                            {flight.passengerDetails.length > 0 ? (
                              flight.passengerDetails.map((paxDetail) => {
                                const pax = formState.passengers.find(
                                  (p) => p.id === paxDetail.passengerId,
                                );
                                if (!pax) return null;

                                return (
                                  <div
                                    key={pax.id}
                                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-md hover:bg-slate-100"
                                  >
                                    <div className="col-span-12 md:col-span-5 flex items-center">
                                      <span className="font-medium text-sm truncate">
                                        {pax.fullName}
                                      </span>
                                    </div>
                                    <div className="col-span-5 md:col-span-3">
                                      <FormInput
                                        label=""
                                        placeholder="Net Cost"
                                        type="number"
                                        disabled={
                                          flight.isNetGrossSameForAll ||
                                          isReadOnly
                                        }
                                        value={paxDetail.netCost || ""}
                                        onChange={(e) =>
                                          handleFlightPaxPriceChange(
                                            index,
                                            pax.id,
                                            "netCost",
                                            +e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="col-span-5 md:col-span-3">
                                      <FormInput
                                        label=""
                                        placeholder="Gross Billed"
                                        type="number"
                                        disabled={
                                          flight.isNetGrossSameForAll ||
                                          isReadOnly
                                        }
                                        value={paxDetail.grossBilled || ""}
                                        onChange={(e) =>
                                          handleFlightPaxPriceChange(
                                            index,
                                            pax.id,
                                            "grossBilled",
                                            +e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="col-span-2 md:col-span-1 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removePassengerFromFlight(
                                            index,
                                            pax.id,
                                          )
                                        }
                                        className="p-2 text-red-500 hover:bg-red-100 rounded-md disabled:text-slate-400 disabled:hover:bg-transparent"
                                        aria-label={`Remove ${pax.fullName} from flight`}
                                        disabled={isReadOnly}
                                      >
                                        {Icons.trash}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-sm text-slate-500 text-center py-2">
                                Add passengers to this flight via the "Add
                                Passenger Manually" button or by uploading an
                                e-ticket.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </Section>
                  <Section
                    title="Hotels"
                    icon={Icons.hotel}
                    bgClass="bg-[#f4fff0]"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <button
                        onClick={() =>
                          addToArray("hotels", {
                            id: `HO-${Date.now()}`,
                            name: "",
                            city: "",
                            country: "",
                            confirmationNumber: "",
                            checkIn: "",
                            checkOut: "",
                            numberOfRooms: 1,
                            roomType: "",
                            mealPlan: "",
                            remarks: "",
                            netCost: 0,
                            grossBilled: 0,
                            supplier: null,
                            paxRefs: [],
                          })
                        }
                        disabled={isReadOnly}
                        className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        {Icons.plus} Add Hotel
                      </button>
                      <label
                        htmlFor="hotel-upload"
                        className={`flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-purple-200 ${isReadOnly ? "cursor-not-allowed bg-slate-200 text-slate-500" : "cursor-pointer"}`}
                      >
                        {Icons.ai} Autofill from Voucher
                      </label>
                      <input
                        id="hotel-upload"
                        type="file"
                        className="hidden"
                        onChange={handleHotelVoucherUpload}
                        accept="image/*,application/pdf"
                        disabled={isReadOnly}
                      />
                    </div>
                    {formState.itinerary.hotels.map((hotel, index) => (
                      <div
                        key={hotel.id}
                        className="p-4 border rounded-md mb-2 bg-slate-50 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end"
                      >
                        <FormInput
                          containerClassName="col-span-2 md:col-span-3 lg:col-span-5"
                          label="Hotel Name"
                          value={hotel.name}
                          onChange={(e) =>
                            handleArrayChange(
                              "hotels",
                              index,
                              "name",
                              e.target.value,
                            )
                          }
                          disabled={isReadOnly}
                        />
                        <FormInput label="City" value={hotel.city || ""} onChange={(e) => handleArrayChange("hotels", index, "city", e.target.value)} disabled={isReadOnly} />
                        <FormInput label="Country" value={hotel.country || ""} onChange={(e) => handleArrayChange("hotels", index, "country", e.target.value)} disabled={isReadOnly} />
                        <FormInput label="Confirmation No." value={hotel.confirmationNumber || ""} onChange={(e) => handleArrayChange("hotels", index, "confirmationNumber", e.target.value)} disabled={isReadOnly} />
                        <FormInput
                          label="Check-in"
                          type="date"
                          value={hotel.checkIn}
                          onChange={(e) =>
                            handleArrayChange(
                              "hotels",
                              index,
                              "checkIn",
                              e.target.value,
                            )
                          }
                          icon={Icons.calendar}
                          disabled={isReadOnly}
                        />
                        <FormInput
                          label="Check-out"
                          type="date"
                          value={hotel.checkOut}
                          onChange={(e) =>
                            handleArrayChange(
                              "hotels",
                              index,
                              "checkOut",
                              e.target.value,
                            )
                          }
                          icon={Icons.calendar}
                          disabled={isReadOnly}
                        />
                        <FormInput
                          label="Nights"
                          type="text"
                          readOnly
                          value={getNumberOfNights(
                            hotel.checkIn,
                            hotel.checkOut,
                          )}
                        />
                        <FormInput
                          label="Rooms"
                          type="number"
                          value={hotel.numberOfRooms}
                          onChange={(e) =>
                            handleArrayChange(
                              "hotels",
                              index,
                              "numberOfRooms",
                              +e.target.value,
                            )
                          }
                          disabled={isReadOnly}
                        />
                        <FormInput label="Room Type" value={hotel.roomType || ""} onChange={(e) => handleArrayChange("hotels", index, "roomType", e.target.value)} disabled={isReadOnly} />
                        <FormInput label="Meal Plan" value={hotel.mealPlan || ""} onChange={(e) => handleArrayChange("hotels", index, "mealPlan", e.target.value)} disabled={isReadOnly} />
                        <FormTextarea containerClassName="col-span-2 md:col-span-3 lg:col-span-5" label="Remarks" value={hotel.remarks || ""} onChange={(e) => handleArrayChange("hotels", index, "remarks", e.target.value)} rows={2} disabled={isReadOnly} />
                        <button
                          onClick={() => removeFromArray("hotels", index)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-md disabled:text-slate-400 disabled:hover:bg-transparent"
                          disabled={isReadOnly}
                        >
                          {Icons.trash} Remove
                        </button>
                        <FormInput
                          label="Net Cost"
                          type="number"
                          value={hotel.netCost}
                          onChange={(e) =>
                            handleArrayChange(
                              "hotels",
                              index,
                              "netCost",
                              +e.target.value,
                            )
                          }
                          disabled={isReadOnly}
                        />
                        <FormInput
                          label="Gross Billed"
                          type="number"
                          value={hotel.grossBilled}
                          onChange={(e) =>
                            handleArrayChange(
                              "hotels",
                              index,
                              "grossBilled",
                              +e.target.value,
                            )
                          }
                          disabled={isReadOnly}
                        />
                        <div className="col-span-2 md:col-span-1">
                          <SupplierSelectControl
                            value={hotel.supplier?.id}
                            onChange={(e) =>
                              handleArrayChange(
                                "hotels",
                                index,
                                "supplier",
                                suppliers.find(
                                  (s) => s.id === e.target.value,
                                ) || null,
                              )
                            }
                          />
                        </div>
                        <div className="col-span-full border-t pt-4 mt-4">
                          <h4 className="font-semibold text-sm mb-2 text-slate-600">
                            Guests for this Hotel
                          </h4>
                          {formState.passengers.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {formState.passengers.map((pax) => (
                                <label
                                  key={pax.id}
                                  className="flex items-center gap-2 p-2 bg-white rounded-md border text-left"
                                >
                                  <input
                                    type="checkbox"
                                    checked={hotel.paxRefs.includes(pax.id)}
                                    onChange={() =>
                                      handleHotelPaxToggle(index, pax.id)
                                    }
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    disabled={isReadOnly}
                                  />
                                  <span className="text-sm truncate">
                                    {pax.fullName}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">
                              Add passengers to the docket first to assign them
                              to this hotel.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </Section>
                  <Section
                    title="Excursions / Activities"
                    icon={Icons.excursion}
                    bgClass="bg-[#fffdf0]"
                  >
                    <button
                      onClick={() =>
                        addToArray("excursions", {
                          id: `EX-${Date.now()}`,
                          name: "",
                          date: "",
                          netCost: 0,
                          grossBilled: 0,
                          supplier: null,
                        })
                      }
                      disabled={isReadOnly}
                      className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 mb-4 disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      {Icons.plus} Add Excursion
                    </button>
                    {formState.itinerary.excursions.map((excursion, index) => (
                      <div
                        key={excursion.id}
                        className="p-4 border rounded-md mb-2 bg-slate-50 grid grid-cols-2 md:grid-cols-4 gap-4 items-end"
                      >
                        <FormInput
                          containerClassName="col-span-2"
                          label="Excursion Name"
                          value={excursion.name}
                          onChange={(e) =>
                            handleArrayChange(
                              "excursions",
                              index,
                              "name",
                              e.target.value,
                            )
                          }
                          disabled={isReadOnly}
                        />
                        <FormInput
                          label="Date"
                          type="date"
                          value={excursion.date}
                          onChange={(e) =>
                            handleArrayChange(
                              "excursions",
                              index,
                              "date",
                              e.target.value,
                            )
                          }
                          icon={Icons.calendar}
                          disabled={isReadOnly}
                        />
                        <button
                          onClick={() => removeFromArray("excursions", index)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-md disabled:text-slate-400 disabled:hover:bg-transparent"
                          disabled={isReadOnly}
                        >
                          {Icons.trash} Remove
                        </button>
                        <FormInput
                          label="Net Cost"
                          type="number"
                          value={excursion.netCost}
                          onChange={(e) =>
                            handleArrayChange(
                              "excursions",
                              index,
                              "netCost",
                              +e.target.value,
                            )
                          }
                          disabled={isReadOnly}
                        />
                        <FormInput
                          label="Gross Billed"
                          type="number"
                          value={excursion.grossBilled}
                          onChange={(e) =>
                            handleArrayChange(
                              "excursions",
                              index,
                              "grossBilled",
                              +e.target.value,
                            )
                          }
                          disabled={isReadOnly}
                        />
                        <div className="col-span-2 md:col-span-1">
                          <SupplierSelectControl
                            value={excursion.supplier?.id}
                            onChange={(e) =>
                              handleArrayChange(
                                "excursions",
                                index,
                                "supplier",
                                suppliers.find(
                                  (s) => s.id === e.target.value,
                                ) || null,
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </Section>
                  <Section
                    title="Transfers"
                    icon={Icons.transfer}
                    bgClass="bg-[#f9f0ff]"
                  >
                    <button
                      onClick={() =>
                        addToArray("transfers", {
                          id: `TR-${Date.now()}`,
                          provider: "",
                          date: "",
                          netCost: 0,
                          grossBilled: 0,
                          supplier: null,
                        })
                      }
                      disabled={isReadOnly}
                      className="flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm font-semibold hover:bg-blue-200 mb-4 disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      {Icons.plus} Add Transfer
                    </button>
                    {formState.itinerary.transfers.map((transfer, index) => (
                      <div
                        key={transfer.id}
                        className="p-4 border rounded-md mb-2 bg-slate-50 grid grid-cols-2 md:grid-cols-4 gap-4 items-end"
                      >
                        <FormInput
                          containerClassName="col-span-2"
                          label="Provider Name"
                          value={transfer.provider}
                          onChange={(e) =>
                            handleArrayChange(
                              "transfers",
                              index,
                              "provider",
                              e.target.value,
                            )
                          }
                          disabled={isReadOnly}
                        />
                        <FormInput
                          label="Date"
                          type="date"
                          value={transfer.date}
                          onChange={(e) =>
                            handleArrayChange(
                              "transfers",
                              index,
                              "date",
                              e.target.value,
                            )
                          }
                          icon={Icons.calendar}
                          disabled={isReadOnly}
                        />
                        <button
                          onClick={() => removeFromArray("transfers", index)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-md disabled:text-slate-400 disabled:hover:bg-transparent"
                          disabled={isReadOnly}
                        >
                          {Icons.trash} Remove
                        </button>
                        <FormInput
                          label="Net Cost"
                          type="number"
                          value={transfer.netCost}
                          onChange={(e) =>
                            handleArrayChange(
                              "transfers",
                              index,
                              "netCost",
                              +e.target.value,
                            )
                          }
                          disabled={isReadOnly}
                        />
                        <FormInput
                          label="Gross Billed"
                          type="number"
                          value={transfer.grossBilled}
                          onChange={(e) =>
                            handleArrayChange(
                              "transfers",
                              index,
                              "grossBilled",
                              +e.target.value,
                            )
                          }
                          disabled={isReadOnly}
                        />
                        <div className="col-span-2 md:col-span-1">
                          <SupplierSelectControl
                            value={transfer.supplier?.id}
                            onChange={(e) =>
                              handleArrayChange(
                                "transfers",
                                index,
                                "supplier",
                                suppliers.find(
                                  (s) => s.id === e.target.value,
                                ) || null,
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </Section>
                  <Section
                    title="Service Charge"
                    icon={Icons.payment}
                    bgClass="bg-[#f0fff9]"
                  >
                    <div className="p-4 border rounded-md mb-2 bg-slate-50 grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                      <FormInput
                        label="Net Cost"
                        type="number"
                        value={formState.itinerary.serviceCharge?.netCost || 0}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            itinerary: {
                              ...p.itinerary,
                              serviceCharge: {
                                ...(p.itinerary.serviceCharge || {
                                  netCost: 0,
                                  grossBilled: 0,
                                }),
                                netCost: +e.target.value,
                              },
                            },
                          }))
                        }
                        disabled={isReadOnly}
                      />
                      <FormInput
                        label="Gross Billed"
                        type="number"
                        value={
                          formState.itinerary.serviceCharge?.grossBilled || 0
                        }
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            itinerary: {
                              ...p.itinerary,
                              serviceCharge: {
                                ...(p.itinerary.serviceCharge || {
                                  netCost: 0,
                                  grossBilled: 0,
                                }),
                                grossBilled: +e.target.value,
                              },
                            },
                          }))
                        }
                        disabled={isReadOnly}
                      />
                    </div>
                  </Section>
                </div>
              </>
            )}

            {activeTab === "payments" && (
              <Section title="Payments" icon={Icons.payment}>
                <NewPaymentForm
                  onAddPayment={addPayment}
                  disabled={isReadOnly}
                />
                <h4 className="text-lg font-semibold mt-6 mb-2">
                  Payment History
                </h4>
                <div className="space-y-2">
                  {formState.payments.map((p) => (
                    <div key={p.id} className="bg-slate-50 p-3 rounded-md ">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-lg text-green-700">
                            {formatCurrency(p.amount)}
                          </p>
                          <p className="text-sm text-slate-600">
                            {p.type} on {formatDate(p.date)}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 italic mt-1">
                        {amountToWords(p.amount)}
                      </p>
                      {p.notes && (
                        <p className="text-xs text-slate-500 mt-1">
                          Note: {p.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {activeTab === "invoices" && (
              <Section title="Invoices" icon={Icons.invoice}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-500">
                    {formState.invoices.length} invoice
                    {formState.invoices.length === 1 ? "" : "s"} on this docket
                  </p>
                  {!isReadOnly && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!docket?.id}
                        onClick={() => setInvoiceModalOpen(true)}
                      >
                        + New Invoice
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={!docket?.id}
                        onClick={() => setZohoModalOpen(true)}
                      >
                        Push to Zoho Books
                      </Button>
                    </div>
                  )}
                </div>

                {!docket?.id ? (
                  <EmptyState
                    title="Save this docket first"
                    description="Invoices can be created once the docket has been saved."
                  />
                ) : formState.invoices.length === 0 ? (
                  <EmptyState
                    title="No invoices yet"
                    description="Generate a local invoice, or push this docket straight to Zoho Books."
                  />
                ) : (
                  <div className="space-y-2">
                    {[...formState.invoices]
                      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                      .map((invoice) =>
                        invoice.zoho ? (
                          <ZohoInvoiceStatusRow
                            key={invoice.id}
                            invoice={invoice}
                            onSaveInvoice={handleSaveInvoice}
                          />
                        ) : (
                          <div
                            key={invoice.id}
                            className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 rounded-lg px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800 text-sm">
                                  {invoice.invoiceNumber}
                                </span>
                                <Badge tone="neutral">local only</Badge>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {formatDate(invoice.date)} · {invoice.billedTo?.name || "No billing name"} ·{" "}
                                {formatCurrency(invoice.grandTotal)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setInvoiceModalOpen(true)}
                            >
                              Open
                            </Button>
                          </div>
                        ),
                      )}
                  </div>
                )}
              </Section>
            )}
            {activeTab === "files" && (
              <>
                <Section title="Files" icon={Icons.file}>
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e)}
                    className="mb-4"
                    disabled={isReadOnly}
                  />
                  <div className="space-y-2">
                    {formState.files.map((f) => {
                      const linkedItemDesc = getLinkedItemDescription(f);
                      return (
                        <div
                          key={f.id}
                          className="bg-slate-100 p-2 rounded flex justify-between items-center"
                        >
                          <div>
                            <p className="font-medium text-slate-700">
                              {f.name} ({(f.size / 1024).toFixed(1)} KB)
                            </p>
                            {linkedItemDesc && (
                              <p className="text-xs text-slate-500 italic">
                                Linked to: {linkedItemDesc}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPreviewFile(f)}
                              className="px-3 py-1 text-xs bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                const dataUrl = `data:${f.type};base64,${f.content}`;
                                const link = document.createElement("a");
                                link.href = dataUrl;
                                link.download = f.name;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="px-3 py-1 text-xs bg-brand-secondary text-white rounded-md hover:bg-slate-700"
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
                <Section title="Comments" icon={Icons.comment}>
                  <NewCommentForm onAddComment={addComment} />
                  <div className="space-y-3 mt-4">
                    {formState.comments.map((c) => (
                      <div
                        key={c.id}
                        className={`p-3 rounded-lg ${c.isSystem ? "bg-slate-100" : "bg-slate-50"}`}
                      >
                        <p className="text-slate-800 whitespace-pre-wrap">
                          {c.isSystem && (
                            <span
                              className="mr-2"
                              role="img"
                              aria-label="System Log"
                            >
                              🔒
                            </span>
                          )}
                          {c.text}
                        </p>
                        <p className="text-xs text-slate-400 text-right mt-1">
                          {c.author || "User"} at{" "}
                          {formatDateTimeIST(c.timestamp)}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}
          </div>
        </div>

        <div className="lg:w-1/3 bg-white p-6 border-l border-slate-200">
          <div className="sticky top-20">
            <div className="space-y-6">
              {forceReadOnly && (
                <div className="p-3 rounded bg-slate-100 border border-slate-300 text-slate-700 text-sm font-semibold">
                  {readOnlyBanner || "Read Only View – Deleted Docket"}
                </div>
              )}
              <div className="bg-slate-50 p-4 rounded-lg shadow-sm">
                <h3 className="font-semibold mb-3">Docket Control</h3>
                <div className="space-y-4">
                  <FormSelect
                    label="Booking Status"
                    value={formState.status}
                    onChange={(e) =>
                      setFormState((p) => ({
                        ...p,
                        status: e.target.value as BookingStatus,
                      }))
                    }
                    disabled={isReadOnly}
                  >
                    {Object.values(BookingStatus).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </FormSelect>
                  <FormSelect
                    label="Tag"
                    value={formState.tag}
                    onChange={(e) =>
                      setFormState((p) => ({
                        ...p,
                        tag: e.target.value as Tag,
                      }))
                    }
                    disabled={isReadOnly}
                  >
                    {Object.values(Tag).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </FormSelect>
                </div>
              </div>
              {!isReadOnly && (
                <div className="bg-slate-50 p-4 rounded-lg shadow-sm">
                  <h3 className="font-semibold mb-3">Actions</h3>
                  <button
                    onClick={() => setActiveTab("invoices")}
                    disabled={!docket?.id}
                    className="w-full bg-teal-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-teal-600 disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                    Invoices
                    {formState.invoices.length > 0 ? ` (${formState.invoices.length})` : ""}
                  </button>
                </div>
              )}
              <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
                <h3 className="font-semibold mb-3 text-blue-800">
                  Financial Summary
                </h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(summaryItems).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between items-center"
                    >
                      <span className="capitalize text-slate-600">{key}</span>
                      <div className="text-right">
                        <p className="font-semibold text-slate-800">
                          {formatCurrency(value.grossBilled)}{" "}
                          <span
                            className={`text-xs ${value.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            ({formatCurrency(value.profit)})
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t mt-2">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">Grand Total</span>
                      <span className="text-slate-900">
                        {formatCurrency(financialSummary.grandTotalGross)}
                      </span>
                    </div>
                    {financialSummary.totalGST > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-700">Total GST</span>
                        <span className="text-blue-600 font-semibold">
                          {formatCurrency(financialSummary.totalGST)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">Total with GST</span>
                      <span className="text-blue-800">
                        {formatCurrency(financialSummary.grandTotalWithGST)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">Total Net</span>
                      <span className="text-slate-900">
                        {formatCurrency(financialSummary.grandTotalNet)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-green-700">
                      <span>Total Profit</span>
                      <span>
                        {formatCurrency(financialSummary.grandTotalProfit)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t mt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-700">Amount Paid</span>
                      <span className="text-green-700 font-semibold">
                        {formatCurrency(financialSummary.amountPaid)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700">Balance Due</span>
                      <span className="text-orange-600">
                        {formatCurrency(financialSummary.balanceDue)}
                      </span>
                    </div>
                  </div>
                  {formState.invoices && formState.invoices.length > 0 && (
                    <div className="pt-2 border-t mt-2">
                      <div className="text-xs text-slate-600 mb-1">
                        📄 Invoices: {formState.invoices.length} saved
                      </div>
                      {financialSummary.totalGST > 0 && (
                        <div className="text-xs text-blue-600">
                          💰 GST Applied:{" "}
                          {formatCurrency(financialSummary.totalGST)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                {!isReadOnly ? (
                  <button
                    onClick={handleSaveClick}
                    disabled={isSaving}
                    className="w-full flex justify-center items-center bg-brand-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
                  >
                    {isSaving ? (
                      <Spinner size="sm" />
                    ) : docket ? (
                      "Save Changes"
                    ) : (
                      "Create Docket"
                    )}
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="w-full flex justify-center items-center bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-lg"
                  >
                    Close
                  </button>
                )}
                {!isReadOnly && docket && (
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <h3 className="font-semibold text-red-800">Danger Zone</h3>
                    <p className="text-sm text-red-600 my-2">
                      Deleting a docket is permanent and cannot be undone.
                    </p>
                    <button
                      onClick={() => setDeleteModalOpen(true)}
                      className="w-full bg-red-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-700"
                    >
                      Delete Docket
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Deletion"
      >
        <p className="mb-4">
          Are you sure you want to delete this docket? This action cannot be
          undone. Please provide a reason for deletion.
        </p>
        <FormTextarea
          label="Reason"
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
          placeholder="Reason for deletion..."
          className="mb-4"
        ></FormTextarea>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteModalOpen(false)}
            className="px-4 py-2 bg-slate-200 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteClick}
            disabled={!deleteReason}
            className="px-4 py-2 bg-red-600 text-white rounded-md disabled:bg-red-300"
          >
            Delete
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        title="Add New Supplier"
      >
        <div className="space-y-4">
          <FormInput
            label="Supplier Name"
            value={newSupplier.name}
            onChange={(e) =>
              setNewSupplier((p) => ({ ...p, name: e.target.value }))
            }
          />
          <FormInput
            label="Contact Person"
            value={newSupplier.contactPerson}
            onChange={(e) =>
              setNewSupplier((p) => ({ ...p, contactPerson: e.target.value }))
            }
          />
          <FormInput
            label="Contact Number"
            value={newSupplier.contactNumber}
            onChange={(e) =>
              setNewSupplier((p) => ({ ...p, contactNumber: e.target.value }))
            }
          />
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setSupplierModalOpen(false)}
              className="px-4 py-2 bg-slate-200 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSupplier}
              className="px-4 py-2 bg-brand-primary text-white rounded-md"
            >
              Save Supplier
            </button>
          </div>
        </div>
      </Modal>

      {invoiceModalOpen && (
        <InvoiceGenerator
          docket={
            {
              ...(docket ? { id: docket.id } : { id: `TEMP-${Date.now()}` }),
              ...formState,
            } as any
          }
          passengers={formState.passengers}
          onClose={() => setInvoiceModalOpen(false)}
          onSaveInvoice={handleSaveInvoice}
        />
      )}

      {zohoModalOpen && docket?.id && (
        <ZohoInvoicePanel
          isOpen={zohoModalOpen}
          docket={{ ...docket, ...formState, id: docket.id } as any}
          passengers={formState.passengers}
          onClose={() => setZohoModalOpen(false)}
          onSaveInvoice={handleSaveInvoice}
        />
      )}

      <Modal
        isOpen={addPaxToFlightIndex !== null}
        onClose={() => setAddPaxToFlightIndex(null)}
        title="Add Passengers to Flight"
      >
        {addPaxToFlightIndex !== null && (
          <AddPaxToFlightModalContent
            availablePassengers={formState.passengers.filter(
              (p) =>
                !formState.itinerary.flights[
                  addPaxToFlightIndex
                ].passengerDetails.some((pd) => pd.passengerId === p.id),
            )}
            onAdd={(selectedIds) =>
              handleAddPassengersToFlight(addPaxToFlightIndex, selectedIds)
            }
            onCancel={() => setAddPaxToFlightIndex(null)}
          />
        )}
      </Modal>

      {previewFile && (
        <Modal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          title={`View File: ${previewFile.name}`}
          width="max-w-5xl"
        >
          {previewFile.type?.includes("pdf") ? (
            <iframe
              src={`data:${previewFile.type};base64,${previewFile.content}`}
              className="w-full"
              style={{ height: "75vh" }}
            />
          ) : (
            <img
              src={`data:${previewFile.type};base64,${previewFile.content}`}
              alt={previewFile.name}
              className="max-h-[75vh] w-auto mx-auto"
            />
          )}
        </Modal>
      )}
    </>
  );
};
