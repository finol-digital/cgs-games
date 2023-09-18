import Image from "next/image";

export default function Page() {
  return (
    <header>
      <Image
        src="/profile.png"
        width={500}
        height={500}
        alt="Picture of the author"
      />
    </header>
  );
}
