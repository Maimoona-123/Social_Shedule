import { PlusIcon } from "lucide-react"
import { PLATFORMS } from "../assets/assets"
import React, { useEffect } from "react"
import AccountList from "../components/AccountList"
import PlatformPickerModal from "../components/PlatformPickerModal"
import toast from "react-hot-toast"
import api from "../api/axios"

const Account = () => {

  const [accounts, setAccounts] = React.useState<any[]>([])
  const [connecting, setConnecting] = React.useState<string | null>(null)
  const [showPlatformPicker, setshowPlatformPicker] = React.useState(false)

  const fetchAccounts = async (isSync = false, platform?: string | null, successMsg?: string) => {
    try {
      if (isSync) {
        const label = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : "social Media";
        toast.loading(`Syncing ${label} accounts...`, { id: "sync" });
        await api.get("/api/oauth/sync");
        toast.success(successMsg || "Account synced!", { id: "sync" })

        const { data } = await api.get("api/accounts");
        setAccounts(data)
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to load accounts")
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedPlatform = params.get("connected");
    const connectedUsername = params.get("username");
    const syncNeeded = params.get("sync") === "true";
    const errorMsg = params.get("error");

    window.history.replaceState({}, document.title, window.location.pathname)

    if (connectedPlatform) {
      const label = connectedPlatform.charAt(0).toUpperCase() + connectedPlatform.slice(1)
      const handle = connectedUsername ? `(@${connectedUsername})` : ""
      fetchAccounts(true, connectedPlatform, `${label}${handle} connected!`)

    } else if (errorMsg) {
      toast.error(`connection failed: ${decodeURIComponent(errorMsg)}`)
      fetchAccounts();

    } else if (syncNeeded) {
      fetchAccounts(true, null, "Accounts synced!..")
    } else{
      fetchAccounts();
    }

    fetchAccounts()
  }, [])

  useEffect(() => {
    fetchAccounts();
  }, [])

  const hadleConnect = async (platformId: string) => {
    setConnecting(platformId);

    try {
      const {data} = await api.get(`/api/oauth/${platformId}/url`);
      window.location.href = data.url;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || `Failed to connect ${platformId}`)
      setConnecting(null)
    }
  }

  const handleDisconnect = async (accountId: string) => {
    try {
      await api.delete(`/api/accounts/${accountId}`)
      toast.success("Account disconnected")
      await fetchAccounts()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to Disconnect account")
      
    }
  }

  const connectedIds = accounts.map((a) => a.platform)

  return (
    <div className="space-y-8 max-w-4xl">

      {/* Header */}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm">
        <div>
          <h2 className="text-xl text-slate-900">Connected Accounts</h2>
          <p className="text-slate-500 text-sm mt-0.5 ">{accounts.length} of {PLATFORMS.length}platforms connected</p>
        </div>

        <button onClick={() => setshowPlatformPicker(true)} className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium
        transition-all w-full sm:w-auto justify-center">
          <PlusIcon className="size-4" />Connect Accounts
        </button>
      </div>

      {/* Platform picker modal */}

      {showPlatformPicker && <PlatformPickerModal connectedIds={connectedIds} connecting={connecting}
        onClose={() => setshowPlatformPicker(false)} onConnect={hadleConnect} />}

      {/* Connected accounts list */}

      <AccountList accounts={accounts} onDisconnect={handleDisconnect} />

    </div>
  )
}

export default Account