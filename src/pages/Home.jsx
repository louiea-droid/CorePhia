import { Helmet } from "react-helmet-async"
import Hero from "../components/Hero"
import ProgramGrid from "../components/ProgramGrid"
import ScienceSection from "../components/ScienceSection"
import TeamSection from "../components/TeamSection"

export default function Home() {
  return (
    <>
      <Helmet>
        <title>CorePhia | Physician-Built Weight Loss Program in Tampa</title>
        <meta
          name="description"
          content="CorePhia builds personalized weight loss programs around real dietitian services, structured exercise, and physician-guided medical care. Start your program today."
        />
        <link rel="canonical" href="https://www.corephia.com/" />
      </Helmet>
      <Hero />
      <ProgramGrid />
      <ScienceSection />
      <TeamSection />
    </>
  )
}
