type PlaceholderPageProps = {
  title: string;
};

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="font-display text-2xl uppercase tracking-pepla text-slateGrey sm:text-3xl">{title}</h1>
    </div>
  );
}
