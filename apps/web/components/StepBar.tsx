export function StepBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex gap-2.5 mb-2">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`flex-1 h-1.5 rounded-full ${
            step > n
              ? 'bg-success'
              : step === n
                ? 'bg-gradient-to-r from-primary to-violet-500'
                : 'bg-border'
          }`}
        />
      ))}
    </div>
  );
}
