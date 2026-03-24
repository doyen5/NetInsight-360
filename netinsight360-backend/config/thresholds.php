<?php
/**
 * NetInsight 360 - Configuration des seuils KPIs
 * 
 * Définit les seuils d'alerte pour chaque KPI selon la technologie
 */

return [
    // KPIs 2G
    '2G' => [
        'RNA' => [
            'name' => 'Radio Network Availability',
            'target' => 99.5,
            'warning' => 95.0,
            'critical' => 90.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'TCH_Availability' => [
            'name' => 'TCH Availability',
            'target' => 99.0,
            'warning' => 95.0,
            'critical' => 90.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'CSSR' => [
            'name' => 'Call Setup Success Rate',
            'target' => 98.0,
            'warning' => 95.0,
            'critical' => 90.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'SDCCH_Cong' => [
            'name' => 'SDCCH Congestion',
            'target' => 0.5,
            'warning' => 1.0,
            'critical' => 2.0,
            'unit' => '%',
            'higher_is_better' => false
        ],
        'SDCCH_Drop' => [
            'name' => 'SDCCH Drop Rate',
            'target' => 0.5,
            'warning' => 1.0,
            'critical' => 2.0,
            'unit' => '%',
            'higher_is_better' => false
        ],
        'TCH_Drop_Rate' => [
            'name' => 'TCH Drop Rate',
            'target' => 2.0,
            'warning' => 3.0,
            'critical' => 5.0,
            'unit' => '%',
            'higher_is_better' => false
        ],
        'TCH_Cong_Rate' => [
            'name' => 'TCH Congestion Rate',
            'target' => 2.0,
            'warning' => 3.0,
            'critical' => 5.0,
            'unit' => '%',
            'higher_is_better' => false
        ],
        'Handover_SR' => [
            'name' => 'Handover Success Rate',
            'target' => 98.0,
            'warning' => 95.0,
            'critical' => 90.0,
            'unit' => '%',
            'higher_is_better' => true
        ]
    ],
    
    // KPIs 3G
    '3G' => [
        'RRC_CS_SR' => [
            'name' => 'RRC CS Success Rate',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'RAB_CS_SR' => [
            'name' => 'RAB CS Success Rate',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'RRC_PS_SR' => [
            'name' => 'RRC PS Success Rate',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'CSSR_CS_SR' => [
            'name' => 'CSSR CS Success Rate',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'CSSR_PS_SR' => [
            'name' => 'CSSR PS Success Rate',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'CS_Drop_Rate' => [
            'name' => 'CS Drop Rate',
            'target' => 2.0,
            'warning' => 3.0,
            'critical' => 5.0,
            'unit' => '%',
            'higher_is_better' => false
        ],
        'PS_Drop_Rate' => [
            'name' => 'PS Drop Rate',
            'target' => 2.0,
            'warning' => 3.0,
            'critical' => 5.0,
            'unit' => '%',
            'higher_is_better' => false
        ],
        'Soft_HO_Rate' => [
            'name' => 'Soft Handover Rate',
            'target' => 98.0,
            'warning' => 95.0,
            'critical' => 92.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'UL_Throughput' => [
            'name' => 'UL Throughput',
            'target' => 5.0,
            'warning' => 3.0,
            'critical' => 1.0,
            'unit' => 'Mbps',
            'higher_is_better' => true
        ],
        'DL_Throughput' => [
            'name' => 'DL Throughput',
            'target' => 15.0,
            'warning' => 10.0,
            'critical' => 5.0,
            'unit' => 'Mbps',
            'higher_is_better' => true
        ]
    ],
    
    // KPIs 4G
    '4G' => [
        'LTE_S1_SR' => [
            'name' => 'LTE S1 Signaling SR',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'LTE_RRC_SR' => [
            'name' => 'LTE RRC SR',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'LTE_ERAB_SR' => [
            'name' => 'LTE ERAB SR',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'LTE_Session_SR' => [
            'name' => 'LTE Session Setup SR',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'LTE_ERAB_Drop' => [
            'name' => 'LTE ERAB Drop Rate',
            'target' => 2.0,
            'warning' => 3.0,
            'critical' => 5.0,
            'unit' => '%',
            'higher_is_better' => false
        ],
        'LTE_CSFB_SR' => [
            'name' => 'LTE CSFB SR',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'LTE_Intra_Freq_SR' => [
            'name' => 'LTE Intra Frequency SR',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'LTE_Inter_Freq_SR' => [
            'name' => 'LTE Inter Frequency SR',
            'target' => 98.0,
            'warning' => 96.0,
            'critical' => 94.0,
            'unit' => '%',
            'higher_is_better' => true
        ],
        'LTE_DL_PRB_Util' => [
            'name' => 'LTE DL PRB Utilization',
            'target' => 70.0,
            'warning' => 80.0,
            'critical' => 90.0,
            'unit' => '%',
            'higher_is_better' => false
        ],
        'LTE_UL_Throughput' => [
            'name' => 'LTE UL Throughput',
            'target' => 20.0,
            'warning' => 15.0,
            'critical' => 10.0,
            'unit' => 'Mbps',
            'higher_is_better' => true
        ],
        'LTE_DL_Throughput' => [
            'name' => 'LTE DL Throughput',
            'target' => 50.0,
            'warning' => 30.0,
            'critical' => 20.0,
            'unit' => 'Mbps',
            'higher_is_better' => true
        ]
    ],
    
    // KPIs CORE
    'CORE' => [
        'Packet_Loss' => [
            'name' => 'Packet Loss',
            'target' => 1.0,
            'warning' => 2.0,
            'critical' => 5.0,
            'unit' => '%',
            'higher_is_better' => false
        ],
        'Latency' => [
            'name' => 'Latency',
            'target' => 100.0,
            'warning' => 150.0,
            'critical' => 200.0,
            'unit' => 'ms',
            'higher_is_better' => false
        ],
        'Jitter' => [
            'name' => 'Jitter',
            'target' => 30.0,
            'warning' => 50.0,
            'critical' => 80.0,
            'unit' => 'ms',
            'higher_is_better' => false
        ],
        'Throughput' => [
            'name' => 'Throughput',
            'target' => 500.0,
            'warning' => 300.0,
            'critical' => 200.0,
            'unit' => 'Gbps',
            'higher_is_better' => true
        ],
        'Availability' => [
            'name' => 'Availability',
            'target' => 99.9,
            'warning' => 99.5,
            'critical' => 99.0,
            'unit' => '%',
            'higher_is_better' => true
        ]
    ]
];