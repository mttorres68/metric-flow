import React from "react";
import { FrotaInfleet } from "../components/FrotaInfleet";

interface Props {
    veiculosInfleet: { id: string; nome: string; placa: string }[];
    vehiclesSel: string[];
    setVehiclesSel: React.Dispatch<React.SetStateAction<string[]>>;
    resumoInfleet: any[];
    loadingInfleet: boolean;
    viagensInfleet: any[];
    loadingViagens: boolean;
    dateStart: string;
    dateEnd: string;
    geocercaId: string | undefined;
}

export function FrotaView(props: Props) {
    return <FrotaInfleet {...props} />;
}
