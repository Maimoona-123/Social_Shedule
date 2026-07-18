import { PlusIcon } from "lucide-react";
import { PLATFORMS } from "../assets/assets";
import React, { useEffect, useState } from "react";
import AccountList from "../components/AccountList";
import PlatformPickerModal from "../components/PlatformPickerModal";
import toast from "react-hot-toast";
import api from "../api/axios";

const Account = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);

  // Fetch Accounts
  const fetchAccounts = async (
    isSync = false,
    platform?: string | null,
    successMsg?: string
  ) => {
    try {
      if (isSync) {
        const label = platform
          ? platform.charAt(0).toUpperCase() + platform.slice(1)
          : "Social Media";

        toast.loading(`Syncing ${label}...`, {
          id: "sync",
        });

        await api.get("/api/oauth/sync");

        toast.success(successMsg || "Accounts synced!", {
          id: "sync",
        });
      }

      // Always fetch accounts
      const { data } = await api.get("/api/accounts");

      console.log("Mongo Accounts:", data);

      setAccounts(data);
    } catch (error: any) {
      console.error(error);

      toast.error(
        error?.response?.data?.message || "Failed to load accounts"
      );
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const connectedPlatform = params.get("connected");
    const connectedUsername = params.get("username");
    const syncNeeded = params.get("sync") === "true";
    const errorMsg = params.get("error");

    window.history.replaceState({}, "", window.location.pathname);

    if (connectedPlatform) {
      const label =
        connectedPlatform.charAt(0).toUpperCase() +
        connectedPlatform.slice(1);

      const handle = connectedUsername
        ? ` (@${connectedUsername})`
        : "";

      fetchAccounts(
        true,
        connectedPlatform,
        `${label}${handle} connected successfully!`
      );
    } else if (syncNeeded) {
      fetchAccounts(true);
    } else if (errorMsg) {
      toast.error(decodeURIComponent(errorMsg));
      fetchAccounts();
    } else {
      fetchAccounts();
    }
  }, []);

  // Connect
  const handleConnect = async (platformId: string) => {
    setConnecting(platformId);

    try {
      const { data } = await api.get(
        `/api/oauth/${platformId}/url`
      );

      window.location.href = data.url;
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          `Failed to connect ${platformId}`
      );

      setConnecting(null);
    }
  };

  // Disconnect
  const handleDisconnect = async (accountId: string) => {
    try {
      await api.delete(`/api/accounts/${accountId}`);

      toast.success("Account disconnected");

      fetchAccounts();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to disconnect account"
      );
    }
  };

  const connectedIds = accounts.map((a) => a.platform);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl text-slate-900">
            Connected Accounts
          </h2>

          <p className="text-slate-500 mt-1">
            {accounts.length} of {PLATFORMS.length} platforms connected
          </p>
        </div>

        <button
          onClick={() => setShowPlatformPicker(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full"
        >
          <PlusIcon size={18} />
          Connect Accounts
        </button>
      </div>

      {/* Modal */}

      {showPlatformPicker && (
        <PlatformPickerModal
          connectedIds={connectedIds}
          connecting={connecting}
          onClose={() => setShowPlatformPicker(false)}
          onConnect={handleConnect}
        />
      )}

      {/* Accounts */}

      <AccountList
        accounts={accounts}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
};

export default Account;