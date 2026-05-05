import Navbar from './components/Navbar'
import Hero from './components/Hero'
import TrustBar from './components/TrustBar'
import Features from './components/Features'
import ScreenshotGallery from './components/ScreenshotGallery'
import PrivacyStatement from './components/PrivacyStatement'
import TechStack from './components/TechStack'
import DownloadCTA from './components/DownloadCTA'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <Navbar />
      <Hero />
      <TrustBar />
      <Features />
      <ScreenshotGallery />
      <PrivacyStatement />
      <TechStack />
      <DownloadCTA />
      <Footer />
    </>
  )
}
