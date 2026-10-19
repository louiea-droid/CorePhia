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
          content="A physician-built weight loss program in Tampa: dietitian services, a personal exercise plan, and medical care when clinically appropriate."
        />
        <link rel="canonical" href="https://corephia.com/" />
      </Helmet>
      <Hero />
      <ProgramGrid />
      <ScienceSection />
      <TeamSection />
    </>
  )
}
