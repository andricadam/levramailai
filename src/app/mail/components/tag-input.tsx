import React, { useState } from 'react';
import Avatar from 'react-avatar';
import Select from 'react-select';
import { api } from '@/trpc/react';
import useThreads from '../use-Threads';

type TagInputProps = {
    suggestions?: string[];
    placeholder: string;
    label: string;

    onChange: (values: { label: string, value: string }[]) => void;
    value: { label: string, value: string }[];
};

const TagInput: React.FC<TagInputProps> = ({ suggestions = [], label, onChange, value }) => {
    const { accountId } = useThreads()
    const [input, setInput] = useState('');
    const { data: emailSuggestions } = api.account.getSuggestions.useQuery({
        accountId,
        query: input
    }, { enabled: !!accountId })

    const formatOptionLabel = ({ label, value }: { label: string; value: string }) => (
        <span className='flex items-center gap-2'>
            <Avatar name={value} size='25' textSizeRatio={2} round={true} />
            {label}
        </span>
    );

    return <div className="border rounded-md flex items-center">
        <span className='ml-3 text-sm text-gray-500'>{label}</span>
        <Select
            value={value}
            // @ts-ignore
            onChange={onChange}
            className='w-full flex-1'
            isMulti
            onInputChange={setInput}
            placeholder={''}
            options={input ? (emailSuggestions?.map(suggestion => ({
                label: suggestion.address,
                value: suggestion.address
            })) || []).concat([{
                label: input,
                value: input
            }]) : emailSuggestions?.map(suggestion => ({
                label: suggestion.address,
                value: suggestion.address
            }))}
            formatOptionLabel={formatOptionLabel}
            classNames={{
                control: () => {
                    return '!border-none !outline-none !ring-0 !shadow-none focus:border-none focus:outline-none focus:ring-0 focus:shadow-none dark:bg-transparent'
                },
                multiValue: () => {
                    return 'dark:!bg-gray-700'
                },
                multiValueLabel: () => {
                    return 'dark:text-white dark:bg-gray-700 rounded-md'
                }
            }}
            classNamePrefix="select"
        />
    </div>
};

export default TagInput;