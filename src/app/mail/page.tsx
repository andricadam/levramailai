import React from 'react'
import Mail from './mail'

export const dynamic = 'force-dynamic'

const MailDashboard = () => {
    return (
        <Mail
            defaultLayout={[20,32,48]}
            navCollapsedSize={4}
            defaultCollapsed={false}
        />
    )
}

export default MailDashboard