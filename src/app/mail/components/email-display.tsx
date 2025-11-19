import DOMPurify from 'isomorphic-dompurify';
import { format } from 'date-fns';
import { type RouterOutputs } from '@/trpc/react';
import { Letter } from 'react-letter';

type Email = RouterOutputs["account"]["getThreads"][number]["emails"][number];

type Props = {
  email: Email;
};

export default function EmailDisplay({ email }: Props) {
  return (
    <div className="flex flex-col gap-2 border-b pb-4 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">
          {email.from?.name || email.from?.address || 'Unknown'}
        </div>
        {email.sentAt && (
          <div className="text-xs text-muted-foreground">
            {format(new Date(email.sentAt), "PPpp")}
          </div>
        )}
      </div>
      {email.subject && (
        <div className="text-sm font-medium">{email.subject}</div>
      )}
      {email.body && (
        <div className="h-4">
          <Letter html={email?.body ?? ''} className='bg-white rounded-d text-black'/>
        </div>
      )}
    </div>
  )
}

