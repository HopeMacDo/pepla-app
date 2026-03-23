import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader, Button, Input, Label, Textarea } from "../ui/primitives";
import { putIntake } from "../lib/storage";
import type { IntakeAvailability, IntakeRequest } from "../lib/models";

async function filesToDataUrls(files: FileList): Promise<string[]> {
  const items = Array.from(files);
  const urls: string[] = [];

  for (const file of items) {
    if (!file.type.startsWith("image/")) continue;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error("Failed to read image"));
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(file);
    });
    urls.push(dataUrl);
  }

  return urls;
}

export default function IntakeStep() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [vision, setVision] = useState("");
  const [availability, setAvailability] = useState<IntakeAvailability>({
    mornings: { tue: false, wed: false, thu: false, fri: false, sat: false },
    afternoons: { tue: false, wed: false, thu: false, fri: false, sat: false }
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dayKeys = ["tue", "wed", "thu", "fri", "sat"] as const;
  const dayLabels = ["Tue", "Wed", "Thu", "Fri", "Sat"];
  const availabilityRows = [
    { key: "mornings", label: "Mornings" },
    { key: "afternoons", label: "Afternoons" }
  ] as const;

  const canSubmit = useMemo(
    () => firstName.trim() && lastName.trim() && phoneNumber.trim() && vision.trim() && !busy,
    [busy, firstName, lastName, phoneNumber, vision]
  );

  function formatAvailability() {
    return availabilityRows
      .map((slot) => {
        const picked = dayKeys
          .filter((day) => availability[slot.key][day])
          .map((day) => day.toUpperCase());
        return `${slot.label}: ${picked.length ? picked.join(", ") : "none"}`;
      })
      .join(" | ");
  }

  async function onPickPhotos(files: FileList | null) {
    setError(null);
    if (!files || files.length === 0) return;
    try {
      const urls = await filesToDataUrls(files);
      setPhotos((p) => [...p, ...urls].slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      const customerName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const req: IntakeRequest = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        customerName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        vision: vision.trim(),
        availability: formatAvailability(),
        availabilitySelections: availability,
        photoDataUrls: photos,
        status: "requests"
      };
      await putIntake(req);
      navigate(`/calendar?name=${encodeURIComponent(req.customerName)}&phone=${encodeURIComponent(req.phoneNumber)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="font-display tracking-pepla text-xs uppercase opacity-75">Intake</div>
          <div className="font-body mt-2 text-2xl">Client details</div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-8">
            <section className="grid gap-4">
              <div className="font-display tracking-pepla text-[11px] uppercase opacity-75">Your details</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="first-name">First name *</Label>
                  <Input
                    id="first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="rounded-none border-x-0 border-t-0 bg-transparent px-0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last-name">Last name *</Label>
                  <Input
                    id="last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    className="rounded-none border-x-0 border-t-0 bg-transparent px-0"
                  />
                </div>
              </div>

              <div className="grid gap-2 md:max-w-md">
                <Label htmlFor="phone">Phone number *</Label>
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(555) 000-0000"
                  inputMode="tel"
                  className="rounded-none border-x-0 border-t-0 bg-transparent px-0"
                />
              </div>
            </section>

            <section className="grid gap-4">
              <div className="font-display tracking-pepla text-[11px] uppercase opacity-75">Your vision</div>
              <div className="grid gap-2">
                <Label htmlFor="vision">Tell me about your vision *</Label>
                <Textarea
                  id="vision"
                  value={vision}
                  onChange={(e) => setVision(e.target.value)}
                  placeholder="e.g. Soft glam for a birthday dinner, natural everyday look, bridal trial for a June wedding..."
                  className="min-h-[130px] rounded-none border-x-0 border-t-0 bg-transparent px-0"
                />
              </div>
            </section>

            <section className="grid gap-4">
              <div className="font-display tracking-pepla text-[11px] uppercase opacity-75">Inspiration</div>
              <div className="grid gap-2">
                <Label htmlFor="photos">Inspiration photos (optional)</Label>
                <label
                  htmlFor="photos"
                  className="grid min-h-[170px] cursor-pointer place-items-center border border-dashed border-slateGrey/20 bg-white/25 px-4 py-8 text-center"
                >
                  <div className="grid gap-1">
                    <div className="font-body text-lg opacity-50">+</div>
                    <div className="font-body text-base">
                      <span className="text-[#9c8a54]">Click to upload</span> or drag photos here
                    </div>
                    <div className="font-body text-sm opacity-60">Up to 8 images</div>
                  </div>
                </label>
                <Input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => onPickPhotos(e.target.files)}
                  className="hidden"
                />
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 pt-1 md:grid-cols-6">
                    {photos.map((src, idx) => (
                      <div key={`${idx}`} className="overflow-hidden border border-slateGrey/15 bg-white/50">
                        <img src={src} alt={`inspiration ${idx + 1}`} className="aspect-square w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4">
              <div className="font-display tracking-pepla text-[11px] uppercase opacity-75">Availability</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slateGrey/15">
                      <th className="pb-3 font-display text-[11px] uppercase tracking-pepla opacity-70"></th>
                      {dayLabels.map((label) => (
                        <th key={label} className="pb-3 text-center font-display text-[11px] uppercase tracking-pepla opacity-70">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {availabilityRows.map((row) => (
                      <tr key={row.key} className="border-b border-slateGrey/15">
                        <td className="py-4 font-body uppercase tracking-[0.08em]">{row.label}</td>
                        {dayKeys.map((day) => (
                          <td key={`${row.key}-${day}`} className="py-4 text-center">
                            <input
                              type="checkbox"
                              checked={availability[row.key][day]}
                              onChange={(e) =>
                                setAvailability((prev) => ({
                                  ...prev,
                                  [row.key]: {
                                    ...prev[row.key],
                                    [day]: e.target.checked
                                  }
                                }))
                              }
                              className="h-5 w-5 accent-slateGrey"
                              aria-label={`${row.label} ${day}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {error && (
              <div className="rounded-xl border border-deepRed/30 bg-white/60 px-4 py-3 font-body text-sm text-deepRed">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setFirstName("");
                  setLastName("");
                  setPhoneNumber("");
                  setVision("");
                  setAvailability({
                    mornings: { tue: false, wed: false, thu: false, fri: false, sat: false },
                    afternoons: { tue: false, wed: false, thu: false, fri: false, sat: false }
                  });
                  setPhotos([]);
                }}
                disabled={busy}
              >
                Reset
              </Button>
              <Button onClick={onSubmit} disabled={!canSubmit}>
                Continue to calendar
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

