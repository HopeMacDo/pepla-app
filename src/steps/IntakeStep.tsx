import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader, Button, Input, Label, Textarea } from "../ui/primitives";
import { putIntake } from "../lib/storage";
import type { IntakeRequest } from "../lib/models";

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
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [availability, setAvailability] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => customerName.trim() && phoneNumber.trim() && availability.trim() && !busy,
    [availability, busy, customerName, phoneNumber]
  );

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
      const req: IntakeRequest = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        customerName: customerName.trim(),
        phoneNumber: phoneNumber.trim(),
        availability: availability.trim(),
        photoDataUrls: photos
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
          <div className="font-display tracking-pepla text-xs uppercase">Step 1</div>
          <div className="font-body mt-2 text-2xl">Intake request</div>
          <div className="font-body mt-2 max-w-2xl opacity-80">
            Collect reference photos and a clear way to reach the client. Keep it minimal, and let the details speak.
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="photos">Reference photos</Label>
              <Input id="photos" type="file" accept="image/*" multiple onChange={(e) => onPickPhotos(e.target.files)} />
              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-3 pt-2">
                  {photos.map((src, idx) => (
                    <div key={`${idx}`} className="overflow-hidden rounded-xl border border-slateGrey/15 bg-white/50">
                      <img src={src} alt={`reference ${idx + 1}`} className="aspect-square w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              {photos.length > 0 && (
                <div className="pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setPhotos([])}>
                    Clear photos
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Customer name</Label>
              <Input id="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (___) ___-____"
                inputMode="tel"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="availability">Availability</Label>
              <Textarea
                id="availability"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="Example: Weekdays after 4pm, Saturdays before 2pm. Prefer March 20–28."
              />
            </div>

            {error && (
              <div className="rounded-xl border border-deepRed/30 bg-white/60 px-4 py-3 font-body text-sm text-deepRed">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setCustomerName("");
                  setPhoneNumber("");
                  setAvailability("");
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

