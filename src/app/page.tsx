import { Button } from "@/components/ui/button"

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'

export default async function Home() {
  return <Button>Hello World</Button> 


}
