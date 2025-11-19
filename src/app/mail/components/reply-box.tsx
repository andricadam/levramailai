import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function ReplyBox() {
  return (
    <div className="p-4 border-t">
      <div className="flex flex-col gap-2">
        <Textarea 
          placeholder="Type your reply here..."
          className="min-h-[100px]"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Send</Button>
        </div>
      </div>
    </div>
  );
}

